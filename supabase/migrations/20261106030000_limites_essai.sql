-- Limites de l'essai gratuit (Idrissa, 2026-11-06 : essai « très très limité »).
-- Choix d'Idrissa : 1 import, 1 quiz de 5 questions, 10 messages au professeur,
-- pas d'appel (réservé aux abonnés). Simples données de la table plans.

alter table public.plans
  add column document_limit int check (document_limit is null or document_limit >= 0),
  add column tutor_message_limit int check (tutor_message_limit is null or tutor_message_limit >= 0),
  add column quiz_question_limit int check (quiz_question_limit is null or quiz_question_limit between 3 and 30);

update public.plans
  set quiz_limit = 1, document_limit = 1, tutor_message_limit = 10, quiz_question_limit = 5, call_minutes_limit = 0
  where kind = 'essai';

-- Le droit en cours expose aussi les nouvelles limites.
drop function public.current_entitlement(uuid);

create function public.current_entitlement(p_user uuid)
returns table (
  plan_code text, quiz_limit int, period_start timestamptz, period_end timestamptz,
  document_limit int, tutor_message_limit int, quiz_question_limit int
)
language sql
stable
security definer
set search_path = ''
as $$
  (
    select s.plan_code, p.quiz_limit, s.starts_at, s.ends_at,
           p.document_limit, p.tutor_message_limit, p.quiz_question_limit
    from public.subscriptions s
    join public.plans p on p.code = s.plan_code
    where s.user_id = p_user and s.status = 'active' and now() >= s.starts_at and now() < s.ends_at
    order by s.ends_at desc
    limit 1
  )
  union all
  (
    select p.code, p.quiz_limit, t.started_at, t.ends_at,
           p.document_limit, p.tutor_message_limit, p.quiz_question_limit
    from public.trials t
    join public.profiles pr on pr.id = t.user_id
    join public.plans p on p.country_code = pr.country_code and p.kind = 'essai'
    where t.user_id = p_user and t.started_at is not null and now() < t.ends_at
      and not exists (
        select 1 from public.subscriptions s
        where s.user_id = p_user and s.status = 'active' and now() >= s.starts_at and now() < s.ends_at
      )
  )
  limit 1;
$$;

revoke execute on function public.current_entitlement(uuid) from public, anon, authenticated;

-- Import : le nombre de documents est désormais aussi limité par le forfait.
create or replace function public.before_document_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_phone text;
  v_days int;
  e record;
  v_used int;
begin
  -- L'état de lecture n'appartient qu'au worker.
  new.status := 'uploaded';
  new.page_count := null;
  new.error_message := null;

  -- Un import à la fois par utilisateur pour ce contrôle (deux onglets, double clic).
  perform pg_advisory_xact_lock(hashtext('lulu_import'), hashtext(new.user_id::text));

  if not exists (
    select 1 from public.trials t where t.user_id = new.user_id and t.started_at is not null
  ) then
    select nullif('+' || ltrim(coalesce(u.phone, ''), '+'), '+') into v_phone
    from auth.users u where u.id = new.user_id;

    select p.duration_days into v_days
    from public.profiles pr
    join public.plans p on p.country_code = pr.country_code and p.kind = 'essai' and p.is_active
    where pr.id = new.user_id;

    -- Pas d'essai si ce numéro en a déjà eu un sur un autre compte.
    if v_days is not null and (
      v_phone is null
      or not exists (select 1 from public.trials t where t.phone_e164 = v_phone and t.user_id <> new.user_id)
    ) then
      insert into public.trials (user_id, phone_e164, started_at, ends_at)
      values (new.user_id, v_phone, now(), now() + make_interval(days => v_days))
      on conflict (user_id) do update
        set started_at = excluded.started_at, ends_at = excluded.ends_at,
            phone_e164 = coalesce(public.trials.phone_e164, excluded.phone_e164)
        where public.trials.started_at is null;
    end if;
  end if;

  select * into e from public.current_entitlement(new.user_id);
  if not found then
    raise exception 'LULU_ACCES_EXPIRE';
  end if;

  -- Nombre d'imports limité par le forfait (essai : 1).
  if e.document_limit is not null then
    select count(*) into v_used from public.documents d
    where d.user_id = new.user_id and d.created_at >= e.period_start and d.created_at < e.period_end;
    if v_used >= e.document_limit then
      raise exception 'LULU_QUOTA_IMPORT_ATTEINT';
    end if;
  end if;

  return new;
end;
$$;

-- Messages au professeur limités par le forfait (essai : 10). Seuls les messages
-- de l'apprenant comptent ; les réponses du professeur ne sont pas décomptées.
create function public.check_tutor_message_quota()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  e record;
  v_used int;
begin
  if new.role <> 'user' then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtext('lulu_tutor'), hashtext(new.user_id::text));
  select * into e from public.current_entitlement(new.user_id);
  if not found then
    raise exception 'LULU_ACCES_EXPIRE';
  end if;
  if e.tutor_message_limit is not null then
    select count(*) into v_used from public.tutor_messages m
    where m.user_id = new.user_id and m.role = 'user'
      and m.created_at >= e.period_start and m.created_at < e.period_end;
    if v_used >= e.tutor_message_limit then
      raise exception 'LULU_QUOTA_MESSAGES_ATTEINT';
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.check_tutor_message_quota() from public, anon, authenticated;

create trigger tutor_messages_quota
  before insert on public.tutor_messages
  for each row execute function public.check_tutor_message_quota();

-- Ce qu'il reste à l'utilisateur connecté sur sa période, pour l'interface
-- (null = sans limite).
create function public.plan_usage()
returns table (
  plan_code text, period_end timestamptz,
  documents_used int, document_limit int,
  tutor_messages_used int, tutor_message_limit int,
  quiz_question_limit int
)
language sql
stable
security definer
set search_path = ''
as $$
  select e.plan_code, e.period_end,
    (select count(*)::int from public.documents d
      where d.user_id = auth.uid() and d.created_at >= e.period_start and d.created_at < e.period_end),
    e.document_limit,
    (select count(*)::int from public.tutor_messages m
      where m.user_id = auth.uid() and m.role = 'user'
        and m.created_at >= e.period_start and m.created_at < e.period_end),
    e.tutor_message_limit,
    e.quiz_question_limit
  from public.current_entitlement(auth.uid()) e;
$$;

revoke execute on function public.plan_usage() from public, anon;
grant execute on function public.plan_usage() to authenticated;
