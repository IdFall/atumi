-- Forfaits commerciaux (Idrissa, 2026-11-11).
--
-- 1. Forfaits payants du Sénégal : Essentiel (3 500 F), Premium (10 000 F) et
--    Enseignant (7 500 F), au mois ou pour 3 mois (-10 %).
-- 2. Espace commun : `plans.library_bytes_limit` borne désormais les cours
--    importés ET Ma bibliothèque (taille lue dans le stockage par la base).
--    `plans.library_upload` dit si le forfait permet d'ajouter des livres
--    (fermé pendant l'essai, qui garde 50 Mo pour ses cours).
-- 3. Recharges (`plans.kind = 'recharge'`) : minutes d'appel (gardées tant que
--    l'abonnement est actif, consommées après celles du forfait) ou espace en
--    plus (pour `duration_days` jours). Achetées comme un forfait (demande de
--    paiement validée par l'équipe), rangées dans `plan_credits`.
-- 4. Profil enseignant à l'inscription (`profiles.role`) : pas d'avis au
--    parent, le niveau choisi est celui où il enseigne.

-- ---------------------------------------------------------------------------
-- Forfaits : recharges, public visé, ajout dans la bibliothèque
-- ---------------------------------------------------------------------------

alter table public.plans drop constraint plans_kind_check;
alter table public.plans add constraint plans_kind_check check (kind in ('essai', 'abonnement', 'recharge'));
alter table public.plans add column audience text not null default 'eleve'
  check (audience in ('eleve', 'enseignant', 'tous'));
alter table public.plans add column library_upload boolean not null default true;

-- Essai : 50 Mo pour ses cours, pas d'ajout dans la bibliothèque.
update public.plans set library_bytes_limit = 52428800, library_upload = false where kind = 'essai';

insert into public.plans (
  code, country_code, kind, audience, label, price_minor, currency, duration_days,
  quiz_limit, quiz_question_limit, document_limit, tutor_message_limit,
  research_daily_limit, call_minutes_limit, library_bytes_limit, library_upload, is_active
) values
  ('sn-essentiel',     'SN', 'abonnement', 'eleve',      'Essentiel',           3500, 'XOF', 30,   20, 10,  10,  200,  5,  15,  1073741824, true, true),
  ('sn-essentiel-3m',  'SN', 'abonnement', 'eleve',      'Essentiel · 3 mois',  9500, 'XOF', 90,   60, 10,  30,  600,  5,  45,  1073741824, true, true),
  ('sn-premium',       'SN', 'abonnement', 'eleve',      'Premium',            10000, 'XOF', 30, null, 15,  40,  600, 15,  90,  5368709120, true, true),
  ('sn-premium-3m',    'SN', 'abonnement', 'eleve',      'Premium · 3 mois',   27000, 'XOF', 90, null, 15, 120, 1800, 15, 270,  5368709120, true, true),
  ('sn-enseignant',    'SN', 'abonnement', 'enseignant', 'Enseignant',          7500, 'XOF', 30, null, 20,  40,  400, 10,  30, 10737418240, true, true),
  ('sn-enseignant-3m', 'SN', 'abonnement', 'enseignant', 'Enseignant · 3 mois',20500, 'XOF', 90, null, 20, 120, 1200, 10,  90, 10737418240, true, true),
  -- Recharges : call_minutes_limit = minutes ajoutées, library_bytes_limit = espace ajouté.
  ('sn-recharge-appel-30',   'SN', 'recharge', 'tous', '+30 min d''appel',       2000, 'XOF', 30, null, null, null, null, null, 30, 0, false, true),
  ('sn-recharge-appel-60',   'SN', 'recharge', 'tous', '+60 min d''appel',       3500, 'XOF', 30, null, null, null, null, null, 60, 0, false, true),
  ('sn-recharge-espace-5go', 'SN', 'recharge', 'tous', '+5 Go d''espace (30 jours)', 1000, 'XOF', 30, null, null, null, null, null, 0, 5368709120, false, true)
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
-- Profil enseignant
-- ---------------------------------------------------------------------------

alter table public.profiles add column role text not null default 'eleve' check (role in ('eleve', 'enseignant'));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_username text := lower(meta ->> 'username');
  v_cycle text := meta ->> 'cycle';
  v_country text := upper(coalesce(meta ->> 'country_code', 'SN'));
  v_guardian text := meta ->> 'guardian_phone';
  v_adult boolean := coalesce((meta ->> 'is_adult')::boolean, false);
  v_role text := case when meta ->> 'role' = 'enseignant' then 'enseignant' else 'eleve' end;
begin
  if not exists (select 1 from public.countries c where c.code = v_country and c.is_active) then
    raise exception 'LULU_PAYS_NON_OUVERT';
  end if;

  if coalesce((meta ->> 'cgu_accepted')::boolean, false) is not true then
    raise exception 'LULU_CGU_NON_ACCEPTEES';
  end if;

  insert into public.profiles (id, username, country_code, cycle, role)
  values (new.id, v_username, v_country, v_cycle, v_role);

  insert into public.consents (user_id, kind, evidence)
  values (new.id, 'cgu', jsonb_build_object('version', meta ->> 'cgu_version'));

  if v_role = 'enseignant' then
    -- Un enseignant est majeur : pas d'avis au parent, quel que soit le niveau enseigné.
    insert into public.consents (user_id, kind, evidence)
    values (new.id, 'majorite', jsonb_build_object('methode', 'enseignant_inscription'));
  elsif v_cycle in ('college', 'lycee') then
    -- Lycéens (et collégiens quand le collège ouvrira).
    if v_adult then
      insert into public.consents (user_id, kind, evidence)
      values (new.id, 'majorite', jsonb_build_object('methode', 'declaration_inscription'));
    else
      if v_guardian is null then
        raise exception 'LULU_ACCORD_PARENTAL_MANQUANT';
      end if;
      insert into public.consents (user_id, kind, guardian_phone_e164, evidence)
      values (new.id, 'parental', v_guardian, jsonb_build_object('methode', 'avis_parent_droit_de_refus'));
      insert into public.parental_notices (user_id, guardian_phone_e164) values (new.id, v_guardian);
    end if;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Recharges achetées
-- ---------------------------------------------------------------------------

create table public.plan_credits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_code text not null references public.plans (code),
  -- Secondes d'appel restantes (diminuent quand le forfait est épuisé).
  call_seconds int not null default 0 check (call_seconds >= 0),
  -- Espace ajouté, jusqu'à ends_at.
  storage_bytes bigint not null default 0 check (storage_bytes >= 0),
  ends_at timestamptz,
  amount_minor bigint not null check (amount_minor >= 0),
  currency text not null,
  payment_provider text not null,
  payment_reference text not null,
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

create index plan_credits_user_created_idx on public.plan_credits (user_id, created_at);

alter table public.plan_credits enable row level security;
create policy "propriétaire : lecture" on public.plan_credits for select using (user_id = auth.uid());
-- Écrites par la base seulement (validation d'un paiement, consommation des minutes).
revoke insert, update, delete on public.plan_credits from anon, authenticated;

alter table public.payment_requests add column credit_id uuid references public.plan_credits (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Espace : cours importés + bibliothèque
-- ---------------------------------------------------------------------------

create function public.storage_used(p_user uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select ((select coalesce(sum(d.size_bytes), 0) from public.documents d where d.user_id = p_user)
        + (select coalesce(sum(b.size_bytes), 0) from public.library_books b where b.user_id = p_user))::bigint;
$$;

-- Espace du droit en cours, recharges d'espace comprises (null = sans limite).
-- À n'appeler que si un droit est en cours (current_entitlement).
create function public.storage_limit(p_user uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select case when p.library_bytes_limit is null then null
              else p.library_bytes_limit + case when p.kind = 'abonnement' then (
                select coalesce(sum(c.storage_bytes), 0) from public.plan_credits c
                where c.user_id = p_user and c.storage_bytes > 0 and (c.ends_at is null or c.ends_at > now())
              ) else 0 end
         end::bigint
  from public.current_entitlement(p_user) e
  join public.plans p on p.code = e.plan_code;
$$;

revoke execute on function public.storage_used(uuid) from public, anon, authenticated;
revoke execute on function public.storage_limit(uuid) from public, anon, authenticated;

-- Bibliothèque : ajout permis par le forfait, fichier présent, espace commun suffisant.
create or replace function public.check_library_quota()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  e record;
  v_upload boolean;
  v_limit bigint;
  v_size bigint;
begin
  perform pg_advisory_xact_lock(hashtext('atumi_espace'), hashtext(new.user_id::text));
  select * into e from public.current_entitlement(new.user_id);
  if not found then
    raise exception 'LULU_ACCES_EXPIRE';
  end if;
  select p.library_upload into v_upload from public.plans p where p.code = e.plan_code;
  v_limit := public.storage_limit(new.user_id);
  if not coalesce(v_upload, false) or v_limit = 0 then
    raise exception 'ATUMI_BIBLIO_ABONNES';
  end if;

  select coalesce((o.metadata ->> 'size')::bigint, 0) into v_size
  from storage.objects o
  where o.bucket_id = 'bibliotheque' and o.name = new.storage_path;
  if not found then
    raise exception 'ATUMI_BIBLIO_FICHIER_ABSENT';
  end if;
  new.size_bytes := v_size;

  if v_limit is not null and public.storage_used(new.user_id) + v_size > v_limit then
    raise exception 'ATUMI_BIBLIO_ESPACE_PLEIN';
  end if;
  return new;
end;
$$;

-- Espace utilisé (cours + bibliothèque) et espace du forfait, pour l'interface.
create or replace function public.library_quota()
returns table (bytes_limit bigint, used bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select public.storage_limit(auth.uid()), public.storage_used(auth.uid())
  from public.current_entitlement(auth.uid()) e;
$$;

create or replace function public.library_upload_allowed()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.current_entitlement(auth.uid()) e
    join public.plans p on p.code = e.plan_code
    where p.library_upload and p.library_bytes_limit is distinct from 0
  );
$$;

-- Import d'un cours : taille lue dans le stockage, refus si l'espace est plein.
-- Passe après documents_before_insert (ordre alphabétique), qui démarre l'essai
-- et refuse l'import sans droit.
create function public.check_document_space()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_size bigint;
  v_limit bigint;
begin
  perform pg_advisory_xact_lock(hashtext('atumi_espace'), hashtext(new.user_id::text));
  select (o.metadata ->> 'size')::bigint into v_size
  from storage.objects o
  where o.bucket_id = 'documents' and o.name = new.storage_path;
  if coalesce(v_size, 0) > 0 then
    new.size_bytes := v_size;
  end if;

  if not exists (select 1 from public.current_entitlement(new.user_id)) then
    return new;
  end if;
  v_limit := public.storage_limit(new.user_id);
  if v_limit is not null and public.storage_used(new.user_id) + new.size_bytes > v_limit then
    raise exception 'ATUMI_ESPACE_PLEIN';
  end if;
  return new;
end;
$$;

revoke execute on function public.check_document_space() from public, anon, authenticated;

create trigger documents_zz_espace
  before insert on public.documents
  for each row execute function public.check_document_space();

-- ---------------------------------------------------------------------------
-- Minutes d'appel : forfait d'abord, puis recharges
-- ---------------------------------------------------------------------------

-- Secondes de recharge utilisables : seulement pendant un abonnement limité en minutes.
create function public.call_credit_seconds(p_user uuid)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select sum(c.call_seconds)::int from public.plan_credits c where c.user_id = p_user and c.call_seconds > 0
  ), 0)
  where exists (
    select 1 from public.current_entitlement(p_user) e
    join public.plans p on p.code = e.plan_code
    where p.kind = 'abonnement' and p.call_minutes_limit is not null
  );
$$;

revoke execute on function public.call_credit_seconds(uuid) from public, anon, authenticated;

-- minutes_limit : forfait + recharges restantes ; seconds_remaining compte les deux.
create or replace function public.call_quota()
returns table (plan_code text, minutes_limit int, seconds_used int, seconds_remaining int, period_end timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select e.plan_code,
         case when p.call_minutes_limit is null then null
              else p.call_minutes_limit + coalesce(public.call_credit_seconds(auth.uid()), 0) / 60 end,
         u.used,
         case when p.call_minutes_limit is null then null
              else greatest(p.call_minutes_limit * 60 - u.used, 0) + coalesce(public.call_credit_seconds(auth.uid()), 0) end,
         e.period_end
  from public.current_entitlement(auth.uid()) e
  join public.plans p on p.code = e.plan_code
  cross join lateral (
    select (coalesce(sum(coalesce(c.duration_seconds,
             extract(epoch from (now() - c.started_at))::int)), 0)
           + public.consumed(auth.uid(), 'call_seconds', e.period_start, e.period_end))::int as used
    from public.tutor_calls c
    where c.user_id = auth.uid() and c.started_at >= e.period_start and c.started_at < e.period_end
  ) u;
$$;

-- Quand la durée d'un appel augmente, la part qui dépasse les minutes du
-- forfait est retirée des recharges, les plus anciennes d'abord.
create function public.consume_call_credits()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  e record;
  v_limit int;
  v_used int;
  v_delta int;
  v_take int;
  c record;
begin
  v_delta := coalesce(new.duration_seconds, 0) - coalesce(old.duration_seconds, 0);
  if v_delta <= 0 then
    return null;
  end if;
  select * into e from public.current_entitlement(new.user_id);
  if not found then
    return null;
  end if;
  select p.call_minutes_limit * 60 into v_limit
  from public.plans p where p.code = e.plan_code and p.kind = 'abonnement';
  if v_limit is null then
    return null;
  end if;

  select (coalesce(sum(coalesce(t.duration_seconds, 0)), 0)
          + public.consumed(new.user_id, 'call_seconds', e.period_start, e.period_end))::int
  into v_used
  from public.tutor_calls t
  where t.user_id = new.user_id and t.started_at >= e.period_start and t.started_at < e.period_end;

  v_delta := greatest(v_used - v_limit, 0) - greatest(v_used - v_delta - v_limit, 0);
  for c in
    select pc.id, pc.call_seconds from public.plan_credits pc
    where pc.user_id = new.user_id and pc.call_seconds > 0
    order by pc.created_at
    for update
  loop
    exit when v_delta <= 0;
    v_take := least(c.call_seconds, v_delta);
    update public.plan_credits set call_seconds = call_seconds - v_take where id = c.id;
    v_delta := v_delta - v_take;
  end loop;
  return null;
end;
$$;

revoke execute on function public.consume_call_credits() from public, anon, authenticated;

create trigger tutor_calls_consume_credits
  after update of duration_seconds on public.tutor_calls
  for each row execute function public.consume_call_credits();

-- ---------------------------------------------------------------------------
-- Demandes de paiement : forfaits et recharges
-- ---------------------------------------------------------------------------

create or replace function public.check_payment_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kind text;
begin
  new.status := 'en_attente';
  new.subscription_id := null;
  new.credit_id := null;
  new.handled_at := null;
  new.reference := trim(new.reference);

  perform pg_advisory_xact_lock(hashtext('atumi_paiement'), hashtext(new.user_id::text));

  select p.kind into v_kind
  from public.plans p
  join public.profiles pr on pr.country_code = p.country_code
  where p.code = new.plan_code and p.kind in ('abonnement', 'recharge') and p.is_active and pr.id = new.user_id;
  if v_kind is null then
    raise exception 'ATUMI_FORFAIT_INCONNU';
  end if;

  -- Une recharge complète un abonnement en cours (pas l'essai).
  if v_kind = 'recharge' and not exists (
    select 1 from public.current_entitlement(new.user_id) e
    join public.plans p on p.code = e.plan_code
    where p.kind = 'abonnement'
  ) then
    raise exception 'ATUMI_RECHARGE_ABONNES';
  end if;

  if (select count(*) from public.payment_requests r
      where r.user_id = new.user_id and r.status = 'en_attente') >= 3 then
    raise exception 'ATUMI_TROP_DE_DEMANDES';
  end if;
  return new;
end;
$$;

-- Ajoute une recharge payée (journalisée).
create function public.admin_grant_credit(
  p_user uuid, p_plan_code text, p_provider text, p_reference text, p_amount_minor bigint default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan public.plans;
  v_id uuid;
begin
  perform public.require_admin();
  select * into v_plan from public.plans where code = p_plan_code and kind = 'recharge';
  if not found then
    raise exception 'ATUMI_FORFAIT_INCONNU';
  end if;
  if not exists (select 1 from public.profiles where id = p_user) then
    raise exception 'ATUMI_ELEVE_INCONNU';
  end if;
  if p_provider !~ '^[a-z_]{2,30}$' or coalesce(trim(p_reference), '') = '' then
    raise exception 'ATUMI_PAIEMENT_INVALIDE';
  end if;

  insert into public.plan_credits (
    user_id, plan_code, call_seconds, storage_bytes, ends_at,
    amount_minor, currency, payment_provider, payment_reference
  ) values (
    p_user, v_plan.code, coalesce(v_plan.call_minutes_limit, 0) * 60, coalesce(v_plan.library_bytes_limit, 0),
    case when coalesce(v_plan.library_bytes_limit, 0) > 0 then now() + make_interval(days => v_plan.duration_days) end,
    coalesce(p_amount_minor, v_plan.price_minor), v_plan.currency, p_provider, trim(p_reference)
  ) returning id into v_id;

  insert into public.admin_actions (user_id, action, target_user_id, details)
  values (auth.uid(), 'recharge_attribuee', p_user, jsonb_build_object(
    'plan', v_plan.code, 'provider', p_provider, 'reference', trim(p_reference),
    'amount_minor', coalesce(p_amount_minor, v_plan.price_minor), 'currency', v_plan.currency));
  return v_id;
end;
$$;

revoke execute on function public.admin_grant_credit(uuid, text, text, text, bigint) from public, anon;
grant execute on function public.admin_grant_credit(uuid, text, text, text, bigint) to authenticated;

-- Valide : attribue le forfait, ou ajoute la recharge.
create or replace function public.admin_confirm_payment_request(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.payment_requests;
  v_kind text;
  v_id uuid;
begin
  perform public.require_admin();
  select * into r from public.payment_requests where id = p_id and status = 'en_attente' for update;
  if not found then
    raise exception 'ATUMI_DEMANDE_INCONNUE';
  end if;
  select kind into v_kind from public.plans where code = r.plan_code;
  if v_kind = 'recharge' then
    v_id := public.admin_grant_credit(r.user_id, r.plan_code, r.provider, r.reference, null);
    update public.payment_requests
      set status = 'validee', credit_id = v_id, handled_at = now()
      where id = p_id;
  else
    v_id := public.admin_grant_plan(r.user_id, r.plan_code, r.provider, r.reference, null);
    update public.payment_requests
      set status = 'validee', subscription_id = v_id, handled_at = now()
      where id = p_id;
  end if;
end;
$$;

-- Vue d'ensemble : les recharges comptent dans les encaissements.
create or replace function public.admin_overview(p_days int default 30)
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
        from (
          select s.payment_provider, s.currency, s.amount_minor from public.subscriptions s
          where s.created_at >= v_from and s.payment_provider <> 'interne' and s.status <> 'cancelled'
          union all
          select c.payment_provider, c.currency, c.amount_minor from public.plan_credits c
          where c.created_at >= v_from
        ) paid
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
