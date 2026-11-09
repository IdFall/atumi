-- Recherche IA avec sources web (Idrissa, 2026-11-09, module « Recherche »).
--
-- L'élève pose une question libre ; le serveur demande au modèle de chercher sur
-- le web et garde la réponse avec ses sources. Une recherche web coûte plus cher
-- qu'un message : nombre limité par 24 h glissantes, selon le forfait
-- (`plans.research_daily_limit` ; null = sans limite), sans droit = refus.

alter table public.plans add column research_daily_limit int check (research_daily_limit >= 0) default 10;
update public.plans set research_daily_limit = 3 where kind = 'essai';

create table public.research_questions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  question text not null check (char_length(question) between 1 and 500),
  answer text,
  -- [{ "url": "...", "title": "..." }] : pages citées par la réponse.
  sources jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index research_questions_user_created_idx on public.research_questions (user_id, created_at desc);

alter table public.research_questions enable row level security;
create policy "propriétaire : lecture" on public.research_questions for select using (user_id = auth.uid());
create policy "propriétaire : suppression" on public.research_questions for delete using (user_id = auth.uid());

-- Question et réponse sont écrites par le serveur ; l'élève peut lire et effacer son historique.
revoke insert, update on public.research_questions from anon, authenticated;

create function public.check_research_quota()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  e record;
  v_limit int;
  v_count int;
begin
  perform pg_advisory_xact_lock(hashtext('lulu_research'), hashtext(new.user_id::text));
  select * into e from public.current_entitlement(new.user_id);
  if not found then
    raise exception 'LULU_ACCES_EXPIRE';
  end if;
  select p.research_daily_limit into v_limit from public.plans p where p.code = e.plan_code;
  if v_limit is not null then
    -- Les recherches effacées comptent aussi (trace dans quota_consumptions).
    select count(*) + public.consumed(new.user_id, 'research', now() - interval '24 hours', now() + interval '1 second')
      into v_count
    from public.research_questions r
    where r.user_id = new.user_id and r.created_at > now() - interval '24 hours';
    if v_count >= v_limit then
      raise exception 'LULU_QUOTA_RECHERCHE_ATTEINT';
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.check_research_quota() from public, anon, authenticated;

create trigger research_questions_quota
  before insert on public.research_questions
  for each row execute function public.check_research_quota();

-- Effacer une recherche ne redonne pas de recherche : la trace reste comptée.
alter table public.quota_consumptions drop constraint quota_consumptions_kind_check;
alter table public.quota_consumptions add constraint quota_consumptions_kind_check
  check (kind in ('document', 'tutor_message', 'quiz', 'call_seconds', 'research'));

create or replace function public.keep_research_consumption()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Une question restée sans réponse (IA indisponible) n'est pas comptée.
  if old.answer is not null and exists (select 1 from auth.users u where u.id = old.user_id) then
    insert into public.quota_consumptions (user_id, kind, amount, counted_at)
    values (old.user_id, 'research', 1, old.created_at);
  end if;
  return old;
end;
$$;

revoke execute on function public.keep_research_consumption() from public, anon, authenticated;

create trigger research_questions_keep_consumption after delete on public.research_questions
  for each row execute function public.keep_research_consumption();

-- Recherches restantes sur 24 h, pour l'interface.
create function public.research_quota()
returns table (daily_limit int, used int, remaining int)
language sql
stable
security definer
set search_path = ''
as $$
  select p.research_daily_limit, u.used,
         case when p.research_daily_limit is null then null else greatest(p.research_daily_limit - u.used, 0) end
  from public.current_entitlement(auth.uid()) e
  join public.plans p on p.code = e.plan_code
  cross join lateral (
    select ((select count(*) from public.research_questions r
              where r.user_id = auth.uid() and r.created_at > now() - interval '24 hours')
           + public.consumed(auth.uid(), 'research', now() - interval '24 hours', now() + interval '1 second'))::int as used
  ) u;
$$;
