-- Défi quiz par WhatsApp (Idrissa, 2026-11-10).
--
-- Après un quiz, l'élève peut défier ses amis : le lien (identifiant aléatoire
-- du défi) ouvre une page publique où l'ami passe les mêmes questions sans
-- compte, puis voit son score à côté de celui de l'élève. Les questions sont
-- lues et corrigées par le serveur (clé secrète) : les réponses attendues ne
-- sortent jamais avant la validation. Aucun appel au modèle, rien n'est
-- décompté du forfait.
--
-- Le défi dure 7 jours ; l'élève peut l'arrêter avant, ou le relancer (même
-- lien, 7 nouveaux jours). Il voit le prénom et le score de chaque ami.

create table public.quiz_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  quiz_id uuid not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  -- Arrêté par l'élève avant la fin du délai.
  closed_at timestamptz,
  unique (quiz_id),
  unique (id, user_id),
  foreign key (quiz_id, user_id) references public.quizzes (id, user_id) on delete cascade
);

-- Parties des amis : visibles par l'élève qui a lancé le défi, et lui seul.
create table public.quiz_challenge_plays (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  challenge_id uuid not null,
  player_name text not null check (char_length(player_name) between 1 and 20),
  correct int not null check (correct >= 0),
  total int not null check (total > 0 and correct <= total),
  created_at timestamptz not null default now(),
  foreign key (challenge_id, user_id) references public.quiz_challenges (id, user_id) on delete cascade
);

create index quiz_challenge_plays_challenge_idx on public.quiz_challenge_plays (challenge_id, created_at desc);

alter table public.quiz_challenges enable row level security;
alter table public.quiz_challenge_plays enable row level security;
create policy "propriétaire : lecture" on public.quiz_challenges for select using (user_id = auth.uid());
create policy "propriétaire : lecture" on public.quiz_challenge_plays for select using (user_id = auth.uid());

-- Créés, arrêtés et comptés par le serveur seulement.
revoke insert, update, delete on public.quiz_challenges from anon, authenticated;
revoke insert, update, delete on public.quiz_challenge_plays from anon, authenticated;

-- Une partie d'ami, seulement sur un défi ouvert ; 100 parties gardées au plus
-- par défi (au-delà, l'ami joue mais rien n'est enregistré).
create function public.record_challenge_play(p_challenge_id uuid, p_player_name text, p_correct int, p_total int)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c record;
begin
  select id, user_id into c from public.quiz_challenges
  where id = p_challenge_id and closed_at is null and expires_at > now()
  for update;
  if not found then
    raise exception 'ATUMI_DEFI_TERMINE';
  end if;
  if (select count(*) from public.quiz_challenge_plays p where p.challenge_id = c.id) >= 100 then
    return;
  end if;
  insert into public.quiz_challenge_plays (user_id, challenge_id, player_name, correct, total)
  values (c.user_id, c.id, p_player_name, p_correct, p_total);
end;
$$;

revoke execute on function public.record_challenge_play(uuid, text, int, int) from public, anon, authenticated;
