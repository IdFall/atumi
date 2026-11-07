-- Synthèses et quiz générés en arrière-plan.
--
-- Le serveur crée d'abord la ligne (« en préparation »), ce qui vérifie le quota
-- avant tout appel au modèle, puis le worker la complète.

alter table public.syntheses
  add column status text not null default 'generating' check (status in ('generating', 'ready', 'failed')),
  add column error_message text,
  add column updated_at timestamptz not null default now(),
  alter column content_md set default '';

alter table public.syntheses add constraint syntheses_id_user_key unique (id, user_id);

create index syntheses_lookup_idx on public.syntheses (user_id, module_id, chapter_id, created_at desc);

alter table public.quizzes
  add column status text not null default 'generating' check (status in ('generating', 'ready', 'failed')),
  add column question_count int not null default 5 check (question_count between 3 and 30),
  add column error_message text;

-- V1 : un quiz se passe une fois ; « Nouveau test » crée un autre quiz.
alter table public.quiz_attempts add constraint quiz_attempts_one_per_quiz unique (quiz_id);

-- Un quiz dont la génération a échoué ne compte pas dans le quota.
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
    select count(*)::int as used from public.quizzes q
    where q.user_id = auth.uid() and q.created_at >= e.period_start and q.created_at < e.period_end and q.status <> 'failed'
  ) u;
$$;
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
    select count(*) into v_used from public.quizzes q
    where q.user_id = new.user_id and q.created_at >= e.period_start and q.created_at < e.period_end and q.status <> 'failed';
    if v_used >= e.quiz_limit then
      raise exception 'LULU_QUOTA_QUIZ_ATTEINT';
    end if;
  end if;
  return new;
end;
$$;
