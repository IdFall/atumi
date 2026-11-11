-- Ma bibliothèque (Idrissa, 2026-11-11).
--
-- L'abonné range ses livres et documents PDF dans un espace limité par le
-- forfait (`plans.library_bytes_limit`, en octets ; null = sans limite,
-- 0 = pas d'ajout, comme pendant l'essai). Les livres offerts par ATUMI
-- (guide IA) ne sont pas en base : ils sont livrés avec l'application.
-- Les fichiers ne passent pas par le modèle : ni synthèse ni quiz.

alter table public.plans add column library_bytes_limit bigint check (library_bytes_limit >= 0) default 209715200;
update public.plans set library_bytes_limit = 0 where kind = 'essai';
update public.plans set library_bytes_limit = null where code = 'sn-testeur';

create table public.library_books (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  storage_path text not null unique,
  -- Taille lue dans le stockage par la base, jamais fournie par le navigateur.
  size_bytes bigint not null default 0 check (size_bytes >= 0),
  created_at timestamptz not null default now(),
  unique (id, user_id),
  check (storage_path like user_id::text || '/%')
);

create index library_books_user_created_idx on public.library_books (user_id, created_at desc);

alter table public.library_books enable row level security;
create policy "propriétaire : lecture" on public.library_books for select using (user_id = auth.uid());
create policy "propriétaire : ajout" on public.library_books for insert with check (user_id = auth.uid());
create policy "propriétaire : suppression" on public.library_books for delete using (user_id = auth.uid());
revoke update on public.library_books from anon, authenticated;

-- Ajout : droit en cours, forfait qui permet l'ajout, fichier présent dans le
-- stockage, et espace suffisant (taille réelle lue dans storage.objects).
create function public.check_library_quota()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  e record;
  v_limit bigint;
  v_size bigint;
  v_used bigint;
begin
  perform pg_advisory_xact_lock(hashtext('atumi_library'), hashtext(new.user_id::text));
  select * into e from public.current_entitlement(new.user_id);
  if not found then
    raise exception 'LULU_ACCES_EXPIRE';
  end if;
  select p.library_bytes_limit into v_limit from public.plans p where p.code = e.plan_code;
  if v_limit = 0 then
    raise exception 'ATUMI_BIBLIO_ABONNES';
  end if;

  select coalesce((o.metadata ->> 'size')::bigint, 0) into v_size
  from storage.objects o
  where o.bucket_id = 'bibliotheque' and o.name = new.storage_path;
  if not found then
    raise exception 'ATUMI_BIBLIO_FICHIER_ABSENT';
  end if;
  new.size_bytes := v_size;

  if v_limit is not null then
    select coalesce(sum(b.size_bytes), 0) into v_used from public.library_books b where b.user_id = new.user_id;
    if v_used + v_size > v_limit then
      raise exception 'ATUMI_BIBLIO_ESPACE_PLEIN';
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.check_library_quota() from public, anon, authenticated;

create trigger library_books_quota
  before insert on public.library_books
  for each row execute function public.check_library_quota();

-- Espace utilisé et espace du forfait, pour l'interface (limite null = sans limite).
create function public.library_quota()
returns table (bytes_limit bigint, used bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select p.library_bytes_limit,
         (select coalesce(sum(b.size_bytes), 0) from public.library_books b where b.user_id = auth.uid())::bigint
  from public.current_entitlement(auth.uid()) e
  join public.plans p on p.code = e.plan_code;
$$;

revoke execute on function public.library_quota() from public, anon;
grant execute on function public.library_quota() to authenticated;

-- Vrai si le forfait en cours permet d'ajouter des livres (dépôt dans le stockage).
create function public.library_upload_allowed()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.current_entitlement(auth.uid()) e
    join public.plans p on p.code = e.plan_code
    where p.library_bytes_limit is distinct from 0
  );
$$;

revoke execute on function public.library_upload_allowed() from public, anon;
grant execute on function public.library_upload_allowed() to authenticated;

-- Fichiers : bucket privé, PDF seulement, un dossier par utilisateur ; dépôt
-- réservé aux forfaits qui permettent l'ajout.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('bibliotheque', 'bibliotheque', false, 52428800, array['application/pdf'])
on conflict (id) do nothing;

create policy "bibliotheque : lecture" on storage.objects for select
  using (bucket_id = 'bibliotheque' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "bibliotheque : dépôt" on storage.objects for insert
  with check (bucket_id = 'bibliotheque' and (storage.foldername(name))[1] = auth.uid()::text
              and public.library_upload_allowed());
create policy "bibliotheque : suppression" on storage.objects for delete
  using (bucket_id = 'bibliotheque' and (storage.foldername(name))[1] = auth.uid()::text);
