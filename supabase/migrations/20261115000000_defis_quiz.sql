-- Défi quiz par WhatsApp (Idrissa, 2026-11-10).
--
-- Après un quiz, l'élève peut défier un ami : le lien (identifiant aléatoire du
-- défi) ouvre une page publique où l'ami passe les mêmes questions sans compte,
-- puis voit son score à côté de celui de l'élève. Les questions sont lues et
-- corrigées par le serveur (clé secrète) : les réponses attendues ne sortent
-- jamais. Aucun appel au modèle, rien n'est décompté du forfait.

create table public.quiz_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  quiz_id uuid not null,
  -- Nombre de parties jouées par les amis (mesure de l'effet du défi).
  play_count int not null default 0 check (play_count >= 0),
  created_at timestamptz not null default now(),
  unique (quiz_id),
  unique (id, user_id),
  foreign key (quiz_id, user_id) references public.quizzes (id, user_id) on delete cascade
);

alter table public.quiz_challenges enable row level security;
create policy "propriétaire : lecture" on public.quiz_challenges for select using (user_id = auth.uid());

-- Créé et compté par le serveur seulement.
revoke insert, update, delete on public.quiz_challenges from anon, authenticated;

-- Une partie de plus, sans course entre deux amis qui jouent en même temps.
create function public.record_challenge_play(p_challenge_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.quiz_challenges set play_count = play_count + 1 where id = p_challenge_id;
$$;

revoke execute on function public.record_challenge_play(uuid) from public, anon, authenticated;
