-- Inscription : le profil et les consentements sont créés par la base,
-- dans la même transaction que le compte, à partir des métadonnées d'inscription.

alter table public.profiles
  add constraint profiles_username_format check (username ~ '^[a-z0-9_.]{3,32}$');

-- Le profil n'est créé que par le déclencheur ci-dessous.
drop policy "profil : création" on public.profiles;

-- L'apprenant ne peut modifier que son niveau et sa langue, pas son pseudo ni son pays.
revoke update on public.profiles from anon, authenticated;
grant update (cycle, education_level_id, locale, updated_at) on public.profiles to authenticated;

create function public.handle_new_user()
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

  -- Collégiens et lycéens : accord d'un parent, déclaré à l'inscription.
  -- La vérification par code envoyé au parent viendra dans une étape suivante.
  if v_cycle in ('college', 'lycee') then
    if v_guardian is null then
      raise exception 'LULU_ACCORD_PARENTAL_MANQUANT';
    end if;
    insert into public.consents (user_id, kind, guardian_phone_e164, evidence)
    values (new.id, 'parental', v_guardian, jsonb_build_object('methode', 'declaration_inscription'));
  end if;

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
