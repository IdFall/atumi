-- Prénom et nom à l'inscription (Idrissa, 2026-11-13) : le formulaire demande
-- « Prénom et nom » (lettres, majuscules ou minuscules, espaces) au lieu d'un
-- nom d'utilisateur. Le nom d'utilisateur reste l'identifiant technique unique,
-- tiré du nom par le serveur (« Idrissa Fall » → « idrissa.fall », chiffres
-- ajoutés s'il est pris). Les comptes créés avant gardent un nom vide.

alter table public.profiles
  add column if not exists full_name text
  check (full_name is null or (char_length(full_name) between 2 and 60 and full_name !~ '[[:cntrl:]]'));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_username text := lower(meta ->> 'username');
  v_full_name text := nullif(regexp_replace(btrim(coalesce(meta ->> 'full_name', '')), '\s+', ' ', 'g'), '');
  v_cycle text := meta ->> 'cycle';
  v_country text := upper(coalesce(meta ->> 'country_code', 'SN'));
  v_guardian text := meta ->> 'guardian_phone';
  v_adult boolean := coalesce((meta ->> 'is_adult')::boolean, false);
  v_age int := case when (meta ->> 'age') ~ '^[0-9]{1,3}$' then (meta ->> 'age')::int end;
  v_role text := case when meta ->> 'role' = 'enseignant' then 'enseignant' else 'eleve' end;
begin
  if not exists (select 1 from public.countries c where c.code = v_country and c.is_active) then
    raise exception 'LULU_PAYS_NON_OUVERT';
  end if;

  if coalesce((meta ->> 'cgu_accepted')::boolean, false) is not true then
    raise exception 'LULU_CGU_NON_ACCEPTEES';
  end if;

  insert into public.profiles (id, username, full_name, country_code, cycle, role)
  values (new.id, v_username, v_full_name, v_country, v_cycle, v_role);

  insert into public.consents (user_id, kind, evidence)
  values (new.id, 'cgu', jsonb_build_object('version', meta ->> 'cgu_version'));

  if v_role = 'enseignant' then
    -- Un enseignant est majeur (âge vérifié à l'inscription) : pas d'avis au parent.
    insert into public.consents (user_id, kind, evidence)
    values (new.id, 'majorite', jsonb_build_object('methode', 'enseignant_inscription', 'age', v_age));
  elsif v_adult then
    insert into public.consents (user_id, kind, evidence)
    values (new.id, 'majorite', jsonb_build_object('methode', 'declaration_age', 'age', v_age));
  elsif v_cycle in ('college', 'lycee') or v_age is not null then
    -- Élève mineur (âge déclaré), quel que soit le niveau : avis au parent, qui peut refuser.
    if v_guardian is null then
      raise exception 'LULU_ACCORD_PARENTAL_MANQUANT';
    end if;
    insert into public.consents (user_id, kind, guardian_phone_e164, evidence)
    values (new.id, 'parental', v_guardian, jsonb_build_object('methode', 'avis_parent_droit_de_refus', 'age', v_age));
    insert into public.parental_notices (user_id, guardian_phone_e164) values (new.id, v_guardian);
  end if;

  return new;
end;
$$;
