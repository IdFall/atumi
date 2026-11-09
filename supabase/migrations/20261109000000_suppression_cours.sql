-- Modifier et supprimer ses modules, chapitres, documents et conversations avec
-- le professeur (Idrissa, 2026-11-09), sans rendre ce que le forfait a déjà compté.
--
-- Les quotas comptent des lignes (documents, messages, quiz, appels). Quand une
-- ligne comptée disparaît (suppression directe ou en cascade), un déclencheur
-- garde sa trace dans `quota_consumptions`, et chaque décompte ajoute ces traces.
-- Supprimer un cours ne redonne donc ni import, ni message, ni quiz, ni minute.
--
-- Reprend aussi la règle de l'import photo : un document illisible (« en échec »)
-- ne compte pas dans les imports.

create table public.quota_consumptions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('document', 'tutor_message', 'quiz', 'call_seconds')),
  amount int not null default 1 check (amount >= 0),
  -- Date de la ligne d'origine : elle reste dans la période où elle a été comptée.
  counted_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index quota_consumptions_user_kind on public.quota_consumptions (user_id, kind, counted_at);

-- Lecture par l'apprenant ; écrit seulement par les déclencheurs ci-dessous.
alter table public.quota_consumptions enable row level security;
create policy "propriétaire : lecture" on public.quota_consumptions for select using (user_id = auth.uid());
revoke insert, update, delete on public.quota_consumptions from anon, authenticated;

-- Consommation conservée d'un utilisateur sur une période.
create function public.consumed(p_user uuid, p_kind text, p_from timestamptz, p_to timestamptz)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(c.amount), 0)::int from public.quota_consumptions c
  where c.user_id = p_user and c.kind = p_kind and c.counted_at >= p_from and c.counted_at < p_to;
$$;

revoke execute on function public.consumed(uuid, text, timestamptz, timestamptz) from public, anon, authenticated;

-- Trace d'une ligne comptée qui disparaît. Rien n'est gardé quand le compte
-- lui-même est supprimé (cascade depuis auth.users).
create function public.keep_quota_consumption()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kind text;
  v_amount int := 1;
  v_at timestamptz := old.created_at;
begin
  if not exists (select 1 from auth.users u where u.id = old.user_id) then
    return old;
  end if;

  if tg_table_name = 'documents' then
    if old.status = 'failed' then return old; end if;
    v_kind := 'document';
  elsif tg_table_name = 'tutor_messages' then
    if old.role <> 'user' then return old; end if;
    v_kind := 'tutor_message';
  elsif tg_table_name = 'quizzes' then
    if old.status = 'failed' then return old; end if;
    v_kind := 'quiz';
  elsif tg_table_name = 'tutor_calls' then
    v_kind := 'call_seconds';
    v_at := old.started_at;
    v_amount := coalesce(old.duration_seconds, greatest(extract(epoch from (now() - old.started_at))::int, 0));
  else
    return old;
  end if;

  insert into public.quota_consumptions (user_id, kind, amount, counted_at)
  values (old.user_id, v_kind, v_amount, v_at);
  return old;
end;
$$;

revoke execute on function public.keep_quota_consumption() from public, anon, authenticated;

create trigger documents_keep_consumption after delete on public.documents
  for each row execute function public.keep_quota_consumption();
create trigger tutor_messages_keep_consumption after delete on public.tutor_messages
  for each row execute function public.keep_quota_consumption();
create trigger quizzes_keep_consumption after delete on public.quizzes
  for each row execute function public.keep_quota_consumption();
create trigger tutor_calls_keep_consumption after delete on public.tutor_calls
  for each row execute function public.keep_quota_consumption();

-- Import : documents présents (sauf illisibles) + documents supprimés.
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

  -- Nombre d'imports limité par le forfait (essai : 1). Un document illisible
  -- ne compte pas ; un document supprimé compte toujours.
  if e.document_limit is not null then
    select count(*) + public.consumed(new.user_id, 'document', e.period_start, e.period_end) into v_used
    from public.documents d
    where d.user_id = new.user_id and d.status <> 'failed'
      and d.created_at >= e.period_start and d.created_at < e.period_end;
    if v_used >= e.document_limit then
      raise exception 'LULU_QUOTA_IMPORT_ATTEINT';
    end if;
  end if;

  return new;
end;
$$;

-- Messages au professeur : messages présents + messages effacés.
create or replace function public.check_tutor_message_quota()
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
    select count(*) + public.consumed(new.user_id, 'tutor_message', e.period_start, e.period_end) into v_used
    from public.tutor_messages m
    where m.user_id = new.user_id and m.role = 'user'
      and m.created_at >= e.period_start and m.created_at < e.period_end;
    if v_used >= e.tutor_message_limit then
      raise exception 'LULU_QUOTA_MESSAGES_ATTEINT';
    end if;
  end if;
  return new;
end;
$$;

-- Quiz : quiz présents (sauf échoués) + quiz supprimés avec leur chapitre.
create or replace function public.check_quiz_quota()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  e record;
  v_used int;
begin
  -- Sérialise les créations de quiz d'un même utilisateur pour un décompte exact.
  perform pg_advisory_xact_lock(hashtext('quiz:' || new.user_id::text));
  select * into e from public.current_entitlement(new.user_id);
  if not found then
    raise exception 'LULU_ACCES_EXPIRE';
  end if;
  if e.quiz_limit is not null then
    select count(*) + public.consumed(new.user_id, 'quiz', e.period_start, e.period_end) into v_used
    from public.quizzes q
    where q.user_id = new.user_id and q.created_at >= e.period_start and q.created_at < e.period_end and q.status <> 'failed';
    if v_used >= e.quiz_limit then
      raise exception 'LULU_QUOTA_QUIZ_ATTEINT';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.quiz_quota()
returns table (plan_code text, quiz_limit int, used int, remaining int, period_end timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select e.plan_code, e.quiz_limit, u.used,
         case when e.quiz_limit is null then null else greatest(e.quiz_limit - u.used, 0) end,
         e.period_end
  from public.current_entitlement(auth.uid()) e
  cross join lateral (
    select (count(*) + public.consumed(auth.uid(), 'quiz', e.period_start, e.period_end))::int as used
    from public.quizzes q
    where q.user_id = auth.uid() and q.created_at >= e.period_start and q.created_at < e.period_end and q.status <> 'failed'
  ) u;
$$;

create or replace function public.plan_usage()
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
      where d.user_id = auth.uid() and d.status <> 'failed'
        and d.created_at >= e.period_start and d.created_at < e.period_end)
      + public.consumed(auth.uid(), 'document', e.period_start, e.period_end),
    e.document_limit,
    (select count(*)::int from public.tutor_messages m
      where m.user_id = auth.uid() and m.role = 'user'
        and m.created_at >= e.period_start and m.created_at < e.period_end)
      + public.consumed(auth.uid(), 'tutor_message', e.period_start, e.period_end),
    e.tutor_message_limit,
    e.quiz_question_limit
  from public.current_entitlement(auth.uid()) e;
$$;

create or replace function public.call_quota()
returns table (plan_code text, minutes_limit int, seconds_used int, seconds_remaining int, period_end timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select e.plan_code, p.call_minutes_limit, u.used,
         case when p.call_minutes_limit is null then null
              else greatest(p.call_minutes_limit * 60 - u.used, 0) end,
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
