-- Accord parental (choix d'Idrissa, 2026-11-09) : « parent prévenu, peut refuser ».
--
--   * À l'inscription, un lycéen indique s'il a 18 ans ou plus. Majeur : pas de
--     numéro de parent (le consentement « majorite » garde sa déclaration).
--   * Mineur : le numéro du parent reste obligatoire. Un avis est préparé ; le
--     worker l'envoie au parent (WhatsApp) avec un lien personnel pour refuser.
--   * Si le parent refuse, le compte est suspendu : plus aucun droit
--     (current_entitlement), jusqu'à une éventuelle réouverture par l'équipe.

alter table public.consents drop constraint consents_kind_check;
alter table public.consents add constraint consents_kind_check check (kind in ('cgu', 'parental', 'majorite'));

-- Suspension après refus d'un parent ; écrite seulement par les fonctions ci-dessous.
alter table public.profiles add column parental_refused_at timestamptz;

create table public.parental_notices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  guardian_phone_e164 text not null check (guardian_phone_e164 ~ '^\+[0-9]{6,15}$'),
  -- Lien personnel envoyé au parent ; jamais montré à l'élève.
  token uuid not null unique default gen_random_uuid(),
  sent_at timestamptz,
  refused_at timestamptz,
  created_at timestamptz not null default now()
);

create index parental_notices_unsent_idx on public.parental_notices (created_at) where sent_at is null;

-- Aucune lecture ni écriture directe : seulement les fonctions ci-dessous et le worker.
alter table public.parental_notices enable row level security;
revoke all on public.parental_notices from anon, authenticated;

-- Inscription : même règles qu'avant, plus la déclaration de majorité et l'avis au parent.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_username text := lower(meta ->> 'username');
  v_cycle text := meta ->> 'cycle';
  v_country text := upper(coalesce(meta ->> 'country_code', 'SN'));
  v_guardian text := meta ->> 'guardian_phone';
  v_adult boolean := coalesce((meta ->> 'is_adult')::boolean, false);
begin
  if not exists (select 1 from public.countries c where c.code = v_country and c.is_active) then
    raise exception 'LULU_PAYS_NON_OUVERT';
  end if;

  if coalesce((meta ->> 'cgu_accepted')::boolean, false) is not true then
    raise exception 'LULU_CGU_NON_ACCEPTEES';
  end if;

  insert into public.profiles (id, username, country_code, cycle)
  values (new.id, v_username, v_country, v_cycle);

  insert into public.consents (user_id, kind, evidence)
  values (new.id, 'cgu', jsonb_build_object('version', meta ->> 'cgu_version'));

  -- Lycéens (et collégiens quand le collège ouvrira).
  if v_cycle in ('college', 'lycee') then
    if v_adult then
      insert into public.consents (user_id, kind, evidence)
      values (new.id, 'majorite', jsonb_build_object('methode', 'declaration_inscription'));
    else
      if v_guardian is null then
        raise exception 'LULU_ACCORD_PARENTAL_MANQUANT';
      end if;
      insert into public.consents (user_id, kind, guardian_phone_e164, evidence)
      values (new.id, 'parental', v_guardian, jsonb_build_object('methode', 'avis_parent_droit_de_refus'));
      insert into public.parental_notices (user_id, guardian_phone_e164) values (new.id, v_guardian);
    end if;
  end if;

  return new;
end;
$$;

-- Droit en cours : aucun pour un compte suspendu par le refus d'un parent.
create or replace function public.current_entitlement(p_user uuid)
returns table (
  plan_code text, quiz_limit int, period_start timestamptz, period_end timestamptz,
  document_limit int, tutor_message_limit int, quiz_question_limit int
)
language sql
stable
security definer
set search_path = ''
as $$
  select * from (
    (
      select s.plan_code, p.quiz_limit, s.starts_at, s.ends_at,
             p.document_limit, p.tutor_message_limit, p.quiz_question_limit
      from public.subscriptions s
      join public.plans p on p.code = s.plan_code
      where s.user_id = p_user and s.status = 'active' and now() >= s.starts_at and now() < s.ends_at
      order by s.ends_at desc
      limit 1
    )
    union all
    (
      select p.code, p.quiz_limit, t.started_at, t.ends_at,
             p.document_limit, p.tutor_message_limit, p.quiz_question_limit
      from public.trials t
      join public.profiles pr on pr.id = t.user_id
      join public.plans p on p.country_code = pr.country_code and p.kind = 'essai'
      where t.user_id = p_user and t.started_at is not null and now() < t.ends_at
        and not exists (
          select 1 from public.subscriptions s
          where s.user_id = p_user and s.status = 'active' and now() >= s.starts_at and now() < s.ends_at
        )
    )
    limit 1
  ) e
  where not exists (
    select 1 from public.profiles pr where pr.id = p_user and pr.parental_refused_at is not null
  );
$$;

-- Page du parent (sans connexion) : à qui correspond le lien.
create function public.parental_notice(p_token uuid)
returns table (username text, refused boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select p.username, n.refused_at is not null
  from public.parental_notices n
  join public.profiles p on p.id = n.user_id
  where n.token = p_token;
$$;

-- Le parent refuse : le compte de l'élève est suspendu.
create function public.refuse_parental_notice(p_token uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
begin
  update public.parental_notices set refused_at = coalesce(refused_at, now())
  where token = p_token
  returning user_id into v_user;
  if v_user is null then
    return false;
  end if;
  update public.profiles set parental_refused_at = coalesce(parental_refused_at, now()) where id = v_user;
  return true;
end;
$$;

revoke execute on function public.parental_notice(uuid) from public;
revoke execute on function public.refuse_parental_notice(uuid) from public;
grant execute on function public.parental_notice(uuid) to anon, authenticated;
grant execute on function public.refuse_parental_notice(uuid) to anon, authenticated;

-- L'élève sait si son compte est suspendu (bandeau d'accès).
create function public.my_parental_status()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p.parental_refused_at is not null then 'refuse'
    when n.id is null then null
    when n.sent_at is null then 'a_envoyer'
    else 'prevenu'
  end
  from public.profiles p
  left join public.parental_notices n on n.user_id = p.id
  where p.id = auth.uid();
$$;

revoke execute on function public.my_parental_status() from public, anon;
grant execute on function public.my_parental_status() to authenticated;

-- ---------------------------------------------------------------------------
-- Administration
-- ---------------------------------------------------------------------------

create function public.admin_parental_notices(p_limit int default 50)
returns table (
  user_id uuid, username text, guardian_phone text, sent_at timestamptz,
  refused_at timestamptz, account_suspended boolean, created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  return query
  select n.user_id, p.username, public.mask_contact(null, n.guardian_phone_e164), n.sent_at,
         n.refused_at, p.parental_refused_at is not null, n.created_at
  from public.parental_notices n
  left join public.profiles p on p.id = n.user_id
  order by (n.refused_at is null), n.created_at desc
  limit greatest(least(p_limit, 200), 1);
end;
$$;

-- Réouvre un compte suspendu (refus par erreur, accord obtenu ensuite).
create function public.admin_reopen_account(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  update public.profiles set parental_refused_at = null where id = p_user and parental_refused_at is not null;
  if not found then
    raise exception 'ATUMI_ELEVE_INCONNU';
  end if;
  insert into public.admin_actions (user_id, action, target_user_id, details)
  values (auth.uid(), 'compte_rouvert', p_user, '{}'::jsonb);
end;
$$;

revoke execute on function public.admin_parental_notices(int) from public, anon;
revoke execute on function public.admin_reopen_account(uuid) from public, anon;
grant execute on function public.admin_parental_notices(int) to authenticated;
grant execute on function public.admin_reopen_account(uuid) to authenticated;
