-- Centre d'aide : questions à l'assistant d'aide et demandes écrites à l'équipe.
--
-- L'assistant d'aide ne compte pas dans les messages au professeur, mais il
-- reste limité par jour pour éviter les abus. La base fait la limite.

create table public.help_questions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  question text not null check (char_length(question) between 1 and 1000),
  answer text,
  helpful boolean,
  created_at timestamptz not null default now()
);

create index help_questions_user_created_idx on public.help_questions (user_id, created_at desc);

alter table public.help_questions enable row level security;
create policy "propriétaire : lecture" on public.help_questions for select using (user_id = auth.uid());
create policy "propriétaire : avis" on public.help_questions for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Question et réponse sont écrites par le serveur ; l'apprenant ne donne que son avis.
revoke insert, update, delete on public.help_questions from anon, authenticated;
grant update (helpful) on public.help_questions to authenticated;

create table public.support_requests (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  message text not null check (char_length(message) between 1 and 2000),
  status text not null default 'nouvelle' check (status in ('nouvelle', 'traitee')),
  -- Envoi à l'équipe par le worker, canal par canal (pas de double envoi en cas de reprise).
  notified_email_at timestamptz,
  notified_whatsapp_at timestamptz,
  created_at timestamptz not null default now()
);

create index support_requests_status_created_idx on public.support_requests (status, created_at);
create index support_requests_user_created_idx on public.support_requests (user_id, created_at desc);

alter table public.support_requests enable row level security;
create policy "propriétaire : lecture" on public.support_requests for select using (user_id = auth.uid());
create policy "propriétaire : envoi" on public.support_requests for insert with check (user_id = auth.uid());

-- L'apprenant envoie un message ; seul le serveur change son état.
revoke insert, update, delete on public.support_requests from anon, authenticated;
grant insert (user_id, message) on public.support_requests to authenticated;

-- Limites quotidiennes (24 h glissantes) : 30 questions à l'assistant, 5 messages à l'équipe.
create function public.check_help_quota()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit int;
  v_count int;
begin
  perform pg_advisory_xact_lock(hashtext('lulu_' || tg_table_name), hashtext(new.user_id::text));

  if tg_table_name = 'help_questions' then
    v_limit := 30;
    select count(*) into v_count from public.help_questions
    where user_id = new.user_id and created_at > now() - interval '24 hours';
  else
    v_limit := 5;
    select count(*) into v_count from public.support_requests
    where user_id = new.user_id and created_at > now() - interval '24 hours';
  end if;

  if v_count >= v_limit then
    raise exception 'LULU_QUOTA_AIDE_ATTEINT';
  end if;
  return new;
end;
$$;

revoke execute on function public.check_help_quota() from public, anon, authenticated;

create trigger help_questions_quota
  before insert on public.help_questions
  for each row execute function public.check_help_quota();

create trigger support_requests_quota
  before insert on public.support_requests
  for each row execute function public.check_help_quota();
