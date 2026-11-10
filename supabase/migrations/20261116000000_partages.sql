-- Partage d'un long texte par WhatsApp (Idrissa, 2026-11-10).
--
-- Un lien WhatsApp ne peut pas porter un texte très long. Au-delà de la
-- limite, l'élève partage le début du texte suivi de « Lire la suite sur
-- ATUMI » : le texte complet (réponse du Prof, recherche ou synthèse) est
-- gardé ici et lisible sans compte par ceux qui ont le lien (identifiant
-- aléatoire), pendant 30 jours. Aucun nom d'élève n'y est affiché.

create table public.shared_texts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  content_md text not null check (char_length(content_md) between 1 and 60000),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days'
);

create index shared_texts_user_created_idx on public.shared_texts (user_id, created_at desc);

alter table public.shared_texts enable row level security;
create policy "propriétaire : lecture" on public.shared_texts for select using (user_id = auth.uid());
create policy "propriétaire : suppression" on public.shared_texts for delete using (user_id = auth.uid());

-- Écrit par le serveur seulement (limite de 30 partages par 24 h, ci-dessous).
revoke insert, update on public.shared_texts from anon, authenticated;

create function public.check_shared_text_quota()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtext('atumi_partage'), hashtext(new.user_id::text));
  if (select count(*) from public.shared_texts s
      where s.user_id = new.user_id and s.created_at > now() - interval '24 hours') >= 30 then
    raise exception 'ATUMI_QUOTA_PARTAGE_ATTEINT';
  end if;
  return new;
end;
$$;

revoke execute on function public.check_shared_text_quota() from public, anon, authenticated;

create trigger shared_texts_quota
  before insert on public.shared_texts
  for each row execute function public.check_shared_text_quota();
