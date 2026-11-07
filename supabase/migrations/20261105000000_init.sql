-- LULU : schéma initial (V1)
--
-- Principes :
--   * chaque ligne appartenant à un apprenant porte user_id ;
--   * la sécurité au niveau des lignes (RLS) est activée partout : un utilisateur
--     ne lit que ses propres données, même si l'API contient une erreur ;
--   * les clés étrangères composites (id, user_id) empêchent de rattacher une
--     ligne à un objet appartenant à un autre utilisateur ;
--   * le pays est un paramètre : pays, niveaux, devise et langue sont des données,
--     pas du code.

create extension if not exists vector;

-- ---------------------------------------------------------------------------
-- Référentiels (lecture publique)
-- ---------------------------------------------------------------------------

create table public.countries (
  code text primary key check (code ~ '^[A-Z]{2}$'),       -- ISO 3166-1 alpha-2
  name text not null,
  currency text not null check (currency ~ '^[A-Z]{3}$'),  -- ISO 4217
  phone_prefix text not null check (phone_prefix ~ '^\+[0-9]{1,4}$'),
  default_locale text not null default 'fr',
  timezone text not null,
  is_active boolean not null default false
);

create table public.education_levels (
  id uuid primary key default gen_random_uuid(),
  country_code text not null references public.countries (code),
  code text not null,
  label text not null,
  cycle text not null check (cycle in ('college', 'lycee', 'universite')),
  sort_order int not null,
  unique (country_code, code)
);

-- ---------------------------------------------------------------------------
-- Comptes
-- ---------------------------------------------------------------------------

-- Aucune donnée d'établissement n'est collectée (décision V1).
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (char_length(username) between 3 and 32),
  country_code text not null references public.countries (code),
  cycle text not null check (cycle in ('college', 'lycee', 'universite')),
  education_level_id uuid references public.education_levels (id),
  locale text not null default 'fr',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('cgu', 'parental')),
  guardian_phone_e164 text check (guardian_phone_e164 ~ '^\+[0-9]{6,15}$'),
  granted_at timestamptz not null default now(),
  evidence jsonb not null default '{}'::jsonb
);

-- ---------------------------------------------------------------------------
-- Organisation des cours : modules (ou matières) et chapitres créés par l'utilisateur
-- ---------------------------------------------------------------------------

create table public.modules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.chapters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  module_id uuid not null,
  title text not null check (char_length(title) between 1 and 200),
  position int not null default 0,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (module_id, user_id) references public.modules (id, user_id) on delete cascade
);

-- ---------------------------------------------------------------------------
-- Documents importés et passages indexés
-- ---------------------------------------------------------------------------

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  module_id uuid not null,
  chapter_id uuid,
  kind text not null check (kind in ('cours', 'examen', 'devoir', 'exercice')),
  title text not null,
  storage_path text not null unique,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  sha256 text,
  page_count int,
  status text not null default 'uploaded'
    check (status in ('uploaded', 'processing', 'ready', 'failed')),
  error_message text,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (module_id, user_id) references public.modules (id, user_id) on delete cascade,
  foreign key (chapter_id, user_id) references public.chapters (id, user_id) on delete set null (chapter_id)
);

-- Dimension 1024 : à ajuster selon le modèle d'embeddings retenu.
create table public.document_chunks (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  document_id uuid not null,
  chapter_id uuid,
  page int,
  section_title text,
  content text not null,
  embedding vector(1024),
  fts tsvector generated always as (to_tsvector('french', content)) stored,
  created_at timestamptz not null default now(),
  foreign key (document_id, user_id) references public.documents (id, user_id) on delete cascade,
  foreign key (chapter_id, user_id) references public.chapters (id, user_id) on delete set null (chapter_id)
);

create index document_chunks_user_idx on public.document_chunks (user_id, chapter_id);
create index document_chunks_embedding_idx on public.document_chunks
  using hnsw (embedding vector_cosine_ops);
create index document_chunks_fts_idx on public.document_chunks using gin (fts);

-- ---------------------------------------------------------------------------
-- Synthèses
-- ---------------------------------------------------------------------------

create table public.syntheses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  module_id uuid not null,
  chapter_id uuid,
  content_md text not null,
  source_document_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  foreign key (module_id, user_id) references public.modules (id, user_id) on delete cascade,
  foreign key (chapter_id, user_id) references public.chapters (id, user_id) on delete cascade
);

-- ---------------------------------------------------------------------------
-- Quiz
-- ---------------------------------------------------------------------------

create table public.quizzes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  module_id uuid not null,
  chapter_id uuid,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (module_id, user_id) references public.modules (id, user_id) on delete cascade,
  foreign key (chapter_id, user_id) references public.chapters (id, user_id) on delete cascade
);

-- Les réponses attendues ne sont jamais lisibles par le client (pas de policy
-- select) : l'API les retire avant d'envoyer le quiz.
create table public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  quiz_id uuid not null,
  position int not null,
  kind text not null check (kind in ('qcm', 'courte')),
  prompt text not null,
  choices jsonb,
  expected_answer jsonb not null,
  explanation text,
  source_chunk_ids bigint[] not null default '{}',
  unique (id, user_id),
  foreign key (quiz_id, user_id) references public.quizzes (id, user_id) on delete cascade
);

create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  quiz_id uuid not null,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  score numeric(5, 4) check (score between 0 and 1),
  unique (id, user_id),
  foreign key (quiz_id, user_id) references public.quizzes (id, user_id) on delete cascade
);

create table public.quiz_answers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  attempt_id uuid not null,
  question_id uuid not null,
  response jsonb not null,
  is_correct boolean,
  feedback text,
  unique (id, user_id),
  unique (attempt_id, question_id),
  foreign key (attempt_id, user_id) references public.quiz_attempts (id, user_id) on delete cascade,
  foreign key (question_id, user_id) references public.quiz_questions (id, user_id) on delete cascade
);

-- Une contestation est enregistrée ; l'IA ne débat pas (décision V1).
create table public.contestations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  answer_id uuid not null,
  reason text check (char_length(reason) <= 1000),
  created_at timestamptz not null default now(),
  foreign key (answer_id, user_id) references public.quiz_answers (id, user_id) on delete cascade
);

-- Calculé côté serveur à partir des quiz.
create table public.chapter_mastery (
  user_id uuid not null,
  chapter_id uuid not null,
  mastery numeric(5, 4) not null check (mastery between 0 and 1),
  answered_count int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, chapter_id),
  foreign key (chapter_id, user_id) references public.chapters (id, user_id) on delete cascade
);

-- ---------------------------------------------------------------------------
-- Tuteur
-- ---------------------------------------------------------------------------

create table public.tutor_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  module_id uuid,
  chapter_id uuid,
  mode text not null check (mode in ('expliquer', 'exercer')),
  created_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (module_id, user_id) references public.modules (id, user_id) on delete set null (module_id),
  foreign key (chapter_id, user_id) references public.chapters (id, user_id) on delete set null (chapter_id)
);

create table public.tutor_messages (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  conversation_id uuid not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  citations jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (conversation_id, user_id) references public.tutor_conversations (id, user_id) on delete cascade
);

-- Tentatives de l'apprenant sur un exercice : la solution n'est donnée qu'après.
create table public.exercise_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  conversation_id uuid not null,
  exercise_ref text not null,
  attempt text not null,
  created_at timestamptz not null default now(),
  foreign key (conversation_id, user_id) references public.tutor_conversations (id, user_id) on delete cascade
);

-- ---------------------------------------------------------------------------
-- Offre : essai d'une journée, abonnements, consommation IA
-- ---------------------------------------------------------------------------

-- Un seul essai par numéro de téléphone ; les 24 h démarrent au premier import.
create table public.trials (
  user_id uuid primary key references auth.users (id) on delete cascade,
  phone_e164 text not null unique check (phone_e164 ~ '^\+[0-9]{6,15}$'),
  started_at timestamptz,
  ends_at timestamptz,
  check ((started_at is null) = (ends_at is null))
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_code text not null,
  status text not null check (status in ('active', 'expired', 'cancelled')),
  amount_minor bigint not null check (amount_minor >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  payment_provider text not null,
  payment_reference text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (payment_provider, payment_reference)
);

create table public.ai_usage (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete set null,
  country_code text references public.countries (code),
  feature text not null,
  model text not null,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  cache_read_tokens int not null default 0,
  created_at timestamptz not null default now()
);

create index ai_usage_user_created_idx on public.ai_usage (user_id, created_at);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.countries enable row level security;
alter table public.education_levels enable row level security;
create policy "lecture publique" on public.countries for select using (true);
create policy "lecture publique" on public.education_levels for select using (true);

alter table public.profiles enable row level security;
create policy "profil : lecture" on public.profiles for select using (id = auth.uid());
create policy "profil : création" on public.profiles for insert with check (id = auth.uid());
create policy "profil : modification" on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

-- Tables entièrement gérées par l'apprenant.
do $$
declare t text;
begin
  foreach t in array array[
    'modules', 'chapters', 'documents', 'tutor_conversations', 'exercise_attempts'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "propriétaire" on public.%I for all using (user_id = auth.uid()) with check (user_id = auth.uid())',
      t);
  end loop;
end $$;

-- Tables lisibles par l'apprenant, écrites uniquement par le serveur (clé service).
do $$
declare t text;
begin
  foreach t in array array[
    'consents', 'document_chunks', 'syntheses', 'quizzes', 'quiz_attempts',
    'quiz_answers', 'chapter_mastery', 'tutor_messages', 'trials',
    'subscriptions', 'ai_usage'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "propriétaire : lecture" on public.%I for select using (user_id = auth.uid())',
      t);
  end loop;
end $$;

-- Aucune lecture client : les réponses attendues restent côté serveur.
alter table public.quiz_questions enable row level security;

alter table public.contestations enable row level security;
create policy "contestation : lecture" on public.contestations for select using (user_id = auth.uid());
create policy "contestation : création" on public.contestations for insert with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Recherche dans les passages (toujours filtrée sur l'utilisateur connecté)
-- ---------------------------------------------------------------------------

create function public.match_document_chunks(
  query_embedding vector(1024),
  match_count int default 8,
  filter_chapter_id uuid default null
)
returns table (id bigint, document_id uuid, page int, content text, similarity float)
language sql stable security invoker
set search_path = public
as $$
  select c.id, c.document_id, c.page, c.content,
         1 - (c.embedding <=> query_embedding) as similarity
  from public.document_chunks c
  where c.user_id = auth.uid()
    and c.embedding is not null
    and (filter_chapter_id is null or c.chapter_id = filter_chapter_id)
  order by c.embedding <=> query_embedding
  limit least(match_count, 20);
$$;

create function public.search_document_chunks(
  query text,
  match_count int default 8,
  filter_chapter_id uuid default null
)
returns table (id bigint, document_id uuid, page int, content text, rank real)
language sql stable security invoker
set search_path = public
as $$
  select c.id, c.document_id, c.page, c.content,
         ts_rank(c.fts, websearch_to_tsquery('french', query)) as rank
  from public.document_chunks c
  where c.user_id = auth.uid()
    and c.fts @@ websearch_to_tsquery('french', query)
    and (filter_chapter_id is null or c.chapter_id = filter_chapter_id)
  order by rank desc
  limit least(match_count, 20);
$$;

-- ---------------------------------------------------------------------------
-- Stockage des fichiers : bucket privé, un dossier par utilisateur
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents', 'documents', false, 20971520,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
on conflict (id) do nothing;

create policy "documents : lecture" on storage.objects for select
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "documents : dépôt" on storage.objects for insert
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "documents : suppression" on storage.objects for delete
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------------
-- Données de départ : Sénégal actif, autres pays prêts à être ouverts
-- ---------------------------------------------------------------------------

insert into public.countries (code, name, currency, phone_prefix, default_locale, timezone, is_active) values
  ('SN', 'Sénégal', 'XOF', '+221', 'fr', 'Africa/Dakar', true),
  ('CI', 'Côte d''Ivoire', 'XOF', '+225', 'fr', 'Africa/Abidjan', false),
  ('ML', 'Mali', 'XOF', '+223', 'fr', 'Africa/Bamako', false),
  ('CM', 'Cameroun', 'XAF', '+237', 'fr', 'Africa/Douala', false);

insert into public.education_levels (country_code, code, label, cycle, sort_order) values
  ('SN', '6e', 'Sixième', 'college', 10),
  ('SN', '5e', 'Cinquième', 'college', 20),
  ('SN', '4e', 'Quatrième', 'college', 30),
  ('SN', '3e', 'Troisième', 'college', 40),
  ('SN', '2nde', 'Seconde', 'lycee', 50),
  ('SN', '1re', 'Première', 'lycee', 60),
  ('SN', 'tle', 'Terminale', 'lycee', 70),
  ('SN', 'l1', 'Licence 1', 'universite', 80),
  ('SN', 'l2', 'Licence 2', 'universite', 90),
  ('SN', 'l3', 'Licence 3', 'universite', 100),
  ('SN', 'm1', 'Master 1', 'universite', 110),
  ('SN', 'm2', 'Master 2', 'universite', 120);
