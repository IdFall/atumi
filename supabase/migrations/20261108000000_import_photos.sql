-- Import de photos de cours (Idrissa, 2026-11-08) : JPG, PNG et WebP en plus
-- du PDF et du Word. La photo est lue par le modèle dans le worker ; si elle
-- est floue, coupée ou illisible, le document passe « en échec » avec un
-- message qui demande de la reprendre.
--
-- Un document en échec ne compte plus dans le nombre d'imports du forfait :
-- l'élève peut reprendre sa photo, même pendant l'essai (1 import).

-- Types de fichiers acceptés par la table et par le bucket privé.
alter table public.documents drop constraint if exists documents_mime_type_check;
alter table public.documents
  add constraint documents_mime_type_check check (mime_type in (
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg', 'image/png', 'image/webp'
  ));

update storage.buckets
  set allowed_mime_types = array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg', 'image/png', 'image/webp'
  ]
  where id = 'documents';

-- Import : même contrôle qu'avant, sans compter les documents en échec.
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
  -- (photo floue, PDF scanné) ne compte pas : l'élève peut le reprendre.
  if e.document_limit is not null then
    select count(*) into v_used from public.documents d
    where d.user_id = new.user_id and d.status <> 'failed'
      and d.created_at >= e.period_start and d.created_at < e.period_end;
    if v_used >= e.document_limit then
      raise exception 'LULU_QUOTA_IMPORT_ATTEINT';
    end if;
  end if;

  return new;
end;
$$;

-- Ce qu'il reste à l'utilisateur connecté : mêmes règles de décompte.
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
        and d.created_at >= e.period_start and d.created_at < e.period_end),
    e.document_limit,
    (select count(*)::int from public.tutor_messages m
      where m.user_id = auth.uid() and m.role = 'user'
        and m.created_at >= e.period_start and m.created_at < e.period_end),
    e.tutor_message_limit,
    e.quiz_question_limit
  from public.current_entitlement(auth.uid()) e;
$$;
