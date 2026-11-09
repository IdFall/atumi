-- Espace administrateur (Idrissa, 2026-11-09) : voir le fonctionnement global
-- d'ATUMI et gérer les forfaits.
--
-- Principes :
--   * l'accès est un rôle en base (table `admins`), vérifié par chaque fonction :
--     l'application n'utilise pas la clé secrète pour l'administration ;
--   * l'administrateur voit des chiffres, des comptes et des paiements, jamais
--     le contenu des cours, des quiz ni des conversations avec le professeur ;
--   * les contacts (e-mail, téléphone) sont masqués ;
--   * chaque action (forfait attribué, annulé, modifié, message traité) est
--     inscrite au journal avec son auteur.

-- ---------------------------------------------------------------------------
-- Rôle administrateur et journal
-- ---------------------------------------------------------------------------

create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;
create policy "propriétaire : lecture" on public.admins for select using (user_id = auth.uid());
revoke insert, update, delete on public.admins from anon, authenticated;

create table public.admin_actions (
  id bigint generated always as identity primary key,
  -- L'administrateur qui a agi.
  user_id uuid not null references auth.users (id) on delete cascade,
  action text not null,
  target_user_id uuid references auth.users (id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index admin_actions_created_idx on public.admin_actions (created_at desc);

-- Lu et écrit seulement par les fonctions d'administration ci-dessous.
alter table public.admin_actions enable row level security;
revoke insert, update, delete on public.admin_actions from anon, authenticated;

-- Premier administrateur : le compte qui a l'accès testeur de l'équipe
-- (attribué à la main, payment_provider = 'interne'). Pour en ajouter un autre :
--
--   insert into public.admins (user_id)
--   select id from public.profiles where username = '<nom d''utilisateur>';
insert into public.admins (user_id)
select distinct s.user_id from public.subscriptions s
where s.plan_code = 'sn-testeur' and s.payment_provider = 'interne' and s.status = 'active'
on conflict (user_id) do nothing;

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins a where a.user_id = auth.uid());
$$;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

create function public.require_admin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.admins a where a.user_id = auth.uid()) then
    raise exception 'ATUMI_ADMIN_REFUSE';
  end if;
end;
$$;

revoke execute on function public.require_admin() from public, anon, authenticated;

-- E-mail ou téléphone masqué : « awa***@gmail.com », « +22177 *** ** 67 ».
create function public.mask_contact(p_email text, p_phone text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when coalesce(p_phone, '') <> '' then
      left('+' || ltrim(p_phone, '+'), 6) || ' *** ** ' || right(p_phone, 2)
    when coalesce(p_email, '') <> '' and position('@' in p_email) > 0 then
      left(split_part(p_email, '@', 1), 3) || '***@' || split_part(p_email, '@', 2)
    else null
  end;
$$;

revoke execute on function public.mask_contact(text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Vue d'ensemble
-- ---------------------------------------------------------------------------

-- Chiffres clés sur les p_days derniers jours (et l'état actuel).
-- Les lignes supprimées par les élèves restent comptées (quota_consumptions).
create function public.admin_overview(p_days int default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_from timestamptz := now() - make_interval(days => greatest(least(p_days, 366), 1));
  v_result jsonb;
begin
  perform public.require_admin();

  select jsonb_build_object(
    'users_total', (select count(*) from public.profiles),
    'users_new', (select count(*) from public.profiles where created_at >= v_from),
    'users_by_cycle', (
      select coalesce(jsonb_object_agg(cycle, n), '{}'::jsonb)
      from (select cycle, count(*) as n from public.profiles group by cycle) c
    ),
    'users_by_tutor_language', (
      select coalesce(jsonb_object_agg(lang, n), '{}'::jsonb)
      from (select coalesce(tutor_language, 'fr') as lang, count(*) as n from public.profiles group by 1) l
    ),
    'trials_active', (select count(*) from public.trials where started_at is not null and ends_at > now()),
    'trials_started', (select count(*) from public.trials where started_at >= v_from),
    'never_imported', (
      select count(*) from public.profiles p
      where not exists (select 1 from public.trials t where t.user_id = p.id and t.started_at is not null)
    ),
    'subscribers_active', (
      select count(distinct s.user_id) from public.subscriptions s
      where s.status = 'active' and now() >= s.starts_at and now() < s.ends_at
        and s.payment_provider <> 'interne'
    ),
    -- Essais devenus payants : un essai a démarré, puis un paiement est arrivé.
    'trials_converted', (
      select count(distinct t.user_id) from public.trials t
      join public.subscriptions s on s.user_id = t.user_id
        and s.payment_provider <> 'interne' and s.amount_minor > 0 and s.created_at >= t.started_at
      where t.started_at is not null
    ),
    'trials_ended', (select count(*) from public.trials where started_at is not null and ends_at <= now()),
    'revenue', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'provider', payment_provider, 'currency', currency, 'amount_minor', amount, 'payments', n
      ) order by amount desc), '[]'::jsonb)
      from (
        select payment_provider, currency, sum(amount_minor) as amount, count(*) as n
        from public.subscriptions
        where created_at >= v_from and payment_provider <> 'interne' and status <> 'cancelled'
        group by payment_provider, currency
      ) r
    ),
    'documents_imported', (
      (select count(*) from public.documents where created_at >= v_from and status <> 'failed')
      + (select coalesce(sum(amount), 0) from public.quota_consumptions where kind = 'document' and counted_at >= v_from)
    ),
    'documents_failed', (select count(*) from public.documents where created_at >= v_from and status = 'failed'),
    'documents_pending', (select count(*) from public.documents where status in ('uploaded', 'processing')),
    'syntheses', (select count(*) from public.syntheses where created_at >= v_from and status = 'ready'),
    'quizzes', (
      (select count(*) from public.quizzes where created_at >= v_from and status <> 'failed')
      + (select coalesce(sum(amount), 0) from public.quota_consumptions where kind = 'quiz' and counted_at >= v_from)
    ),
    'quiz_attempts', (select count(*) from public.quiz_attempts where submitted_at >= v_from),
    'quiz_average', (select round(avg(score) * 100) from public.quiz_attempts where submitted_at >= v_from),
    'tutor_messages', (
      (select count(*) from public.tutor_messages where created_at >= v_from and role = 'user')
      + (select coalesce(sum(amount), 0) from public.quota_consumptions where kind = 'tutor_message' and counted_at >= v_from)
    ),
    'calls', (select count(*) from public.tutor_calls where started_at >= v_from),
    'call_minutes', (
      ((select coalesce(sum(duration_seconds), 0) from public.tutor_calls where started_at >= v_from)
      + (select coalesce(sum(amount), 0) from public.quota_consumptions where kind = 'call_seconds' and counted_at >= v_from)) / 60
    ),
    'contestations', (select count(*) from public.contestations where created_at >= v_from),
    'help_questions', (select count(*) from public.help_questions where created_at >= v_from),
    'help_helpful', (select count(*) from public.help_questions where created_at >= v_from and helpful),
    'help_not_helpful', (select count(*) from public.help_questions where created_at >= v_from and helpful = false),
    'support_open', (select count(*) from public.support_requests where status = 'nouvelle'),
    'ai_calls', (select count(*) from public.ai_usage where created_at >= v_from),
    'ai_input_tokens', (select coalesce(sum(input_tokens), 0) from public.ai_usage where created_at >= v_from),
    'ai_output_tokens', (select coalesce(sum(output_tokens), 0) from public.ai_usage where created_at >= v_from)
  ) into v_result;

  return v_result;
end;
$$;

-- Activité jour par jour (UTC) sur les p_days derniers jours.
create function public.admin_daily(p_days int default 14)
returns table (day date, signups int, documents int, quizzes int, tutor_messages int, call_minutes int)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  return query
  select d::date,
    (select count(*)::int from public.profiles p where p.created_at::date = d::date),
    (select count(*)::int from public.documents x where x.created_at::date = d::date and x.status <> 'failed')
      + (select coalesce(sum(c.amount), 0)::int from public.quota_consumptions c where c.kind = 'document' and c.counted_at::date = d::date),
    (select count(*)::int from public.quizzes q where q.created_at::date = d::date and q.status <> 'failed')
      + (select coalesce(sum(c.amount), 0)::int from public.quota_consumptions c where c.kind = 'quiz' and c.counted_at::date = d::date),
    (select count(*)::int from public.tutor_messages m where m.created_at::date = d::date and m.role = 'user')
      + (select coalesce(sum(c.amount), 0)::int from public.quota_consumptions c where c.kind = 'tutor_message' and c.counted_at::date = d::date),
    (((select coalesce(sum(t.duration_seconds), 0) from public.tutor_calls t where t.started_at::date = d::date)
      + (select coalesce(sum(c.amount), 0) from public.quota_consumptions c where c.kind = 'call_seconds' and c.counted_at::date = d::date)) / 60)::int
  from generate_series(current_date - (greatest(least(p_days, 90), 1) - 1), current_date, interval '1 day') d
  order by 1;
end;
$$;

-- Consommation du modèle par fonction et par modèle.
create function public.admin_ai_usage(p_days int default 30)
returns table (feature text, model text, calls int, input_tokens bigint, output_tokens bigint, cache_read_tokens bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  return query
  select u.feature, u.model, count(*)::int, sum(u.input_tokens)::bigint,
         sum(u.output_tokens)::bigint, sum(u.cache_read_tokens)::bigint
  from public.ai_usage u
  where u.created_at >= now() - make_interval(days => greatest(least(p_days, 366), 1))
  group by u.feature, u.model
  order by 4 desc;
end;
$$;

-- ---------------------------------------------------------------------------
-- Élèves : comptes, droit en cours et volumes d'activité (jamais le contenu)
-- ---------------------------------------------------------------------------

create function public.admin_users(p_search text default null, p_limit int default 50)
returns table (
  user_id uuid, username text, country_code text, cycle text, level_label text, contact text,
  created_at timestamptz, plan_code text, plan_label text, plan_kind text, access_end timestamptz,
  trial_state text, documents int, quizzes int, tutor_messages int, last_activity timestamptz,
  is_admin boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  return query
  select p.id, p.username, p.country_code, p.cycle, l.label,
    public.mask_contact(u.email, u.phone),
    p.created_at, e.plan_code, pl.label, pl.kind, e.period_end,
    case
      when t.started_at is null then 'jamais'
      when t.ends_at > now() then 'en_cours'
      else 'termine'
    end,
    (select count(*)::int from public.documents d where d.user_id = p.id and d.status <> 'failed'),
    (select count(*)::int from public.quizzes q where q.user_id = p.id and q.status <> 'failed'),
    (select count(*)::int from public.tutor_messages m where m.user_id = p.id and m.role = 'user'),
    greatest(
      (select max(d.created_at) from public.documents d where d.user_id = p.id),
      (select max(q.created_at) from public.quizzes q where q.user_id = p.id),
      (select max(m.created_at) from public.tutor_messages m where m.user_id = p.id)
    ),
    exists (select 1 from public.admins a where a.user_id = p.id)
  from public.profiles p
  left join auth.users u on u.id = p.id
  left join public.education_levels l on l.id = p.education_level_id
  left join public.trials t on t.user_id = p.id
  left join lateral (select * from public.current_entitlement(p.id)) e on true
  left join public.plans pl on pl.code = e.plan_code
  where p_search is null or p_search = '' or p.username ilike '%' || p_search || '%'
  order by p.created_at desc
  limit greatest(least(p_limit, 200), 1);
end;
$$;

-- Abonnements (paiements) : d'un élève, ou les plus récents.
create function public.admin_subscriptions(p_user uuid default null, p_limit int default 50)
returns table (
  id uuid, user_id uuid, username text, plan_code text, plan_label text, status text,
  amount_minor bigint, currency text, payment_provider text, payment_reference text,
  starts_at timestamptz, ends_at timestamptz, created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  return query
  select s.id, s.user_id, p.username, s.plan_code, pl.label, s.status, s.amount_minor, s.currency,
         s.payment_provider, s.payment_reference, s.starts_at, s.ends_at, s.created_at
  from public.subscriptions s
  left join public.profiles p on p.id = s.user_id
  left join public.plans pl on pl.code = s.plan_code
  where p_user is null or s.user_id = p_user
  order by s.created_at desc
  limit greatest(least(p_limit, 200), 1);
end;
$$;

-- ---------------------------------------------------------------------------
-- Forfaits : liste, création, modification
-- ---------------------------------------------------------------------------

create function public.admin_plans()
returns table (
  code text, country_code text, kind text, label text, price_minor bigint, currency text,
  duration_days int, quiz_limit int, document_limit int, tutor_message_limit int,
  quiz_question_limit int, call_minutes_limit int, is_active boolean, subscribers int
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  return query
  select pl.code, pl.country_code, pl.kind, pl.label, pl.price_minor, pl.currency, pl.duration_days,
         pl.quiz_limit, pl.document_limit, pl.tutor_message_limit, pl.quiz_question_limit,
         pl.call_minutes_limit, pl.is_active,
         (select count(distinct s.user_id)::int from public.subscriptions s
          where s.plan_code = pl.code and s.status = 'active' and now() >= s.starts_at and now() < s.ends_at)
  from public.plans pl
  order by pl.country_code, pl.kind desc, pl.price_minor, pl.code;
end;
$$;

-- Crée un forfait payant ou modifie un forfait existant (null = sans limite).
-- L'essai garde son type ; un nouveau forfait est toujours un abonnement.
create function public.admin_save_plan(
  p_code text, p_country_code text, p_label text, p_price_minor bigint, p_duration_days int,
  p_quiz_limit int, p_document_limit int, p_tutor_message_limit int, p_quiz_question_limit int,
  p_call_minutes_limit int, p_is_active boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_currency text;
  v_existing boolean;
begin
  perform public.require_admin();
  if p_code !~ '^[a-z]{2}-[a-z0-9-]{2,40}$' then
    raise exception 'ATUMI_FORFAIT_CODE_INVALIDE';
  end if;

  select exists (select 1 from public.plans where code = p_code) into v_existing;
  if v_existing then
    update public.plans set
      label = p_label, price_minor = p_price_minor, duration_days = p_duration_days,
      quiz_limit = p_quiz_limit, document_limit = p_document_limit,
      tutor_message_limit = p_tutor_message_limit, quiz_question_limit = p_quiz_question_limit,
      call_minutes_limit = p_call_minutes_limit, is_active = p_is_active
    where code = p_code;
  else
    select c.currency into v_currency from public.countries c where c.code = p_country_code;
    if v_currency is null then
      raise exception 'ATUMI_PAYS_INCONNU';
    end if;
    insert into public.plans (
      code, country_code, kind, label, price_minor, currency, duration_days, quiz_limit,
      document_limit, tutor_message_limit, quiz_question_limit, call_minutes_limit, is_active
    ) values (
      p_code, p_country_code, 'abonnement', p_label, p_price_minor, v_currency, p_duration_days,
      p_quiz_limit, p_document_limit, p_tutor_message_limit, p_quiz_question_limit,
      p_call_minutes_limit, p_is_active
    );
  end if;

  insert into public.admin_actions (user_id, action, details)
  values (auth.uid(), case when v_existing then 'forfait_modifie' else 'forfait_cree' end,
    jsonb_build_object('code', p_code, 'label', p_label, 'price_minor', p_price_minor,
      'duration_days', p_duration_days, 'is_active', p_is_active));
end;
$$;

-- Attribue un forfait à un élève après un paiement reçu à la main (Wave,
-- Orange Money...). Le forfait commence maintenant, ou à la fin de son
-- abonnement payant en cours (pas de jours perdus en cas de renouvellement).
create function public.admin_grant_plan(
  p_user uuid, p_plan_code text, p_provider text, p_reference text, p_amount_minor bigint default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan public.plans;
  v_start timestamptz;
  v_id uuid;
begin
  perform public.require_admin();
  select * into v_plan from public.plans where code = p_plan_code and kind = 'abonnement';
  if not found then
    raise exception 'ATUMI_FORFAIT_INCONNU';
  end if;
  if not exists (select 1 from public.profiles where id = p_user) then
    raise exception 'ATUMI_ELEVE_INCONNU';
  end if;
  if p_provider !~ '^[a-z_]{2,30}$' or coalesce(trim(p_reference), '') = '' then
    raise exception 'ATUMI_PAIEMENT_INVALIDE';
  end if;

  select greatest(now(), coalesce(max(s.ends_at), now())) into v_start
  from public.subscriptions s
  where s.user_id = p_user and s.status = 'active' and s.ends_at > now() and s.payment_provider <> 'interne';

  insert into public.subscriptions (
    user_id, plan_code, status, amount_minor, currency, payment_provider, payment_reference, starts_at, ends_at
  ) values (
    p_user, v_plan.code, 'active', coalesce(p_amount_minor, v_plan.price_minor), v_plan.currency,
    p_provider, trim(p_reference), v_start, v_start + make_interval(days => v_plan.duration_days)
  ) returning id into v_id;

  insert into public.admin_actions (user_id, action, target_user_id, details)
  values (auth.uid(), 'forfait_attribue', p_user, jsonb_build_object(
    'plan', v_plan.code, 'provider', p_provider, 'reference', trim(p_reference),
    'amount_minor', coalesce(p_amount_minor, v_plan.price_minor), 'currency', v_plan.currency));
  return v_id;
end;
$$;

-- Annule un abonnement (erreur de saisie, remboursement).
create function public.admin_cancel_subscription(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
begin
  perform public.require_admin();
  update public.subscriptions set status = 'cancelled' where id = p_id and status = 'active'
  returning user_id into v_user;
  if v_user is null then
    raise exception 'ATUMI_ABONNEMENT_INCONNU';
  end if;
  insert into public.admin_actions (user_id, action, target_user_id, details)
  values (auth.uid(), 'abonnement_annule', v_user, jsonb_build_object('subscription', p_id));
end;
$$;

-- ---------------------------------------------------------------------------
-- Messages à l'équipe (centre d'aide)
-- ---------------------------------------------------------------------------

create function public.admin_support_requests(p_status text default null, p_limit int default 100)
returns table (
  id bigint, user_id uuid, username text, contact text, message text, status text,
  notified_email_at timestamptz, notified_whatsapp_at timestamptz, created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  return query
  select r.id, r.user_id, p.username, public.mask_contact(u.email, u.phone), r.message, r.status,
         r.notified_email_at, r.notified_whatsapp_at, r.created_at
  from public.support_requests r
  left join public.profiles p on p.id = r.user_id
  left join auth.users u on u.id = r.user_id
  where p_status is null or r.status = p_status
  order by r.created_at desc
  limit greatest(least(p_limit, 500), 1);
end;
$$;

create function public.admin_set_support_status(p_id bigint, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
begin
  perform public.require_admin();
  if p_status not in ('nouvelle', 'traitee') then
    raise exception 'ATUMI_ETAT_INVALIDE';
  end if;
  update public.support_requests set status = p_status where id = p_id returning user_id into v_user;
  if v_user is null then
    raise exception 'ATUMI_MESSAGE_INCONNU';
  end if;
  insert into public.admin_actions (user_id, action, target_user_id, details)
  values (auth.uid(), 'message_' || p_status, v_user, jsonb_build_object('support_request', p_id));
end;
$$;

-- ---------------------------------------------------------------------------
-- Journal des actions d'administration
-- ---------------------------------------------------------------------------

create function public.admin_journal(p_limit int default 100)
returns table (id bigint, created_at timestamptz, admin_username text, action text, target_username text, details jsonb)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  return query
  select j.id, j.created_at, a.username, j.action, t.username, j.details
  from public.admin_actions j
  left join public.profiles a on a.id = j.user_id
  left join public.profiles t on t.id = j.target_user_id
  order by j.created_at desc
  limit greatest(least(p_limit, 500), 1);
end;
$$;

-- Appelables par tout compte connecté : chacune refuse un non-administrateur.
revoke execute on function public.admin_overview(int) from public, anon;
revoke execute on function public.admin_daily(int) from public, anon;
revoke execute on function public.admin_ai_usage(int) from public, anon;
revoke execute on function public.admin_users(text, int) from public, anon;
revoke execute on function public.admin_subscriptions(uuid, int) from public, anon;
revoke execute on function public.admin_plans() from public, anon;
revoke execute on function public.admin_save_plan(text, text, text, bigint, int, int, int, int, int, int, boolean) from public, anon;
revoke execute on function public.admin_grant_plan(uuid, text, text, text, bigint) from public, anon;
revoke execute on function public.admin_cancel_subscription(uuid) from public, anon;
revoke execute on function public.admin_support_requests(text, int) from public, anon;
revoke execute on function public.admin_set_support_status(bigint, text) from public, anon;
revoke execute on function public.admin_journal(int) from public, anon;

grant execute on function public.admin_overview(int) to authenticated;
grant execute on function public.admin_daily(int) to authenticated;
grant execute on function public.admin_ai_usage(int) to authenticated;
grant execute on function public.admin_users(text, int) to authenticated;
grant execute on function public.admin_subscriptions(uuid, int) to authenticated;
grant execute on function public.admin_plans() to authenticated;
grant execute on function public.admin_save_plan(text, text, text, bigint, int, int, int, int, int, int, boolean) to authenticated;
grant execute on function public.admin_grant_plan(uuid, text, text, text, bigint) to authenticated;
grant execute on function public.admin_cancel_subscription(uuid) to authenticated;
grant execute on function public.admin_support_requests(text, int) to authenticated;
grant execute on function public.admin_set_support_status(bigint, text) to authenticated;
grant execute on function public.admin_journal(int) to authenticated;
