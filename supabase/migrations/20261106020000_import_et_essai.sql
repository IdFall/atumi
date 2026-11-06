-- Import d'un document et démarrage de l'essai gratuit.
--
-- L'essai de 24 h démarre au premier import, une seule fois par numéro de
-- téléphone. Tout se passe dans la base, dans la même transaction que l'import :
-- impossible d'importer sans droit, impossible de redémarrer un essai.

-- Comptes ouverts avec un e-mail seul : pas de numéro, un essai par compte.
alter table public.trials alter column phone_e164 drop not null;

-- Le fichier doit être rangé dans le dossier de son propriétaire.
alter table public.documents
  add constraint documents_storage_path_owner check (storage_path like user_id::text || '/%');

-- L'apprenant peut renommer ou reclasser un document, pas changer son état de lecture.
revoke update on public.documents from anon, authenticated;
grant update (title, kind, chapter_id) on public.documents to authenticated;

create function public.before_document_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_phone text;
  v_days int;
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

  if not exists (select 1 from public.current_entitlement(new.user_id)) then
    raise exception 'LULU_ACCES_EXPIRE';
  end if;

  return new;
end;
$$;

revoke execute on function public.before_document_insert() from public, anon, authenticated;

create trigger documents_before_insert
  before insert on public.documents
  for each row execute function public.before_document_insert();

-- Droit en cours de l'utilisateur connecté, pour l'interface (bandeau d'essai, abonnement).
create function public.my_access()
returns table (plan_code text, kind text, period_end timestamptz, trial_used boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select e.plan_code, p.kind, e.period_end,
         exists (select 1 from public.trials t where t.user_id = auth.uid() and t.started_at is not null)
  from (select 1) one
  left join public.current_entitlement(auth.uid()) e on true
  left join public.plans p on p.code = e.plan_code;
$$;

revoke execute on function public.my_access() from public, anon;
grant execute on function public.my_access() to authenticated;
