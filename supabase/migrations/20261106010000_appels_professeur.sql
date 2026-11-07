-- Modes du professeur IA ajoutés depuis la migration initiale.
alter table public.tutor_conversations drop constraint tutor_conversations_mode_check;
alter table public.tutor_conversations
  add constraint tutor_conversations_mode_check
  check (mode in ('expliquer', 'approfondir', 'exercer', 'decouvrir'));

-- Appels (voix, vidéo en option) avec le professeur IA, intégrés à la V1.
-- La transcription est enregistrée dans tutor_messages, comme une conversation écrite :
-- mêmes règles, mêmes citations. Aucun enregistrement audio ni vidéo n'est conservé.

alter table public.plans
  -- Minutes d'appel par période ; null = sans limite.
  add column call_minutes_limit int check (call_minutes_limit is null or call_minutes_limit >= 0);

-- Essai : 10 minutes, valeur provisoire à valider.
update public.plans set call_minutes_limit = 10 where kind = 'essai';

create table public.tutor_calls (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  conversation_id uuid not null,
  language text not null check (language in ('fr', 'en', 'wo')),
  with_video boolean not null default false,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  -- Durée facturée, arrondie à la seconde par le serveur à la fin de l'appel.
  duration_seconds int check (duration_seconds is null or duration_seconds >= 0),
  end_reason text check (end_reason in ('raccroche', 'quota', 'connexion', 'erreur')),
  unique (id, user_id),
  foreign key (conversation_id, user_id) references public.tutor_conversations (id, user_id) on delete cascade,
  check ((ended_at is null) = (duration_seconds is null))
);

create index tutor_calls_user_started on public.tutor_calls (user_id, started_at);

-- Lecture par l'apprenant ; création et clôture par le serveur seulement (durée facturée).
alter table public.tutor_calls enable row level security;
create policy "propriétaire : lecture" on public.tutor_calls for select using (user_id = auth.uid());
revoke insert, update, delete on public.tutor_calls from anon, authenticated;

-- Minutes d'appel restantes pour l'utilisateur connecté (null = sans limite).
create function public.call_quota()
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
    select coalesce(sum(coalesce(c.duration_seconds,
             extract(epoch from (now() - c.started_at))::int)), 0)::int as used
    from public.tutor_calls c
    where c.user_id = auth.uid() and c.started_at >= e.period_start and c.started_at < e.period_end
  ) u;
$$;

revoke execute on function public.call_quota() from public, anon;
grant execute on function public.call_quota() to authenticated;
