-- Niveaux des enseignants (Idrissa, 2026-11-12) : un enseignant choisit le
-- niveau où il enseigne parmi Primaire, Collège, Lycée, École supérieure et
-- Université. Les élèves restent limités aux niveaux ouverts (V1 : lycée et
-- université, `education_levels.is_open`).

alter table public.education_levels drop constraint education_levels_cycle_check;
alter table public.education_levels
  add constraint education_levels_cycle_check
  check (cycle in ('primaire', 'college', 'lycee', 'ecole_superieure', 'universite'));

alter table public.profiles drop constraint profiles_cycle_check;
alter table public.profiles
  add constraint profiles_cycle_check
  check (cycle in ('primaire', 'college', 'lycee', 'ecole_superieure', 'universite'));

-- Niveau qu'un enseignant peut choisir, même fermé aux élèves.
alter table public.education_levels add column open_to_teachers boolean not null default true;

insert into public.education_levels (country_code, code, label, cycle, sort_order, is_open, open_to_teachers) values
  ('SN', 'primaire', 'Primaire', 'primaire', 5, false, true),
  ('SN', 'ecole-sup', 'École supérieure', 'ecole_superieure', 75, false, true)
on conflict (country_code, code) do nothing;

-- Un élève : niveau ouvert ; un enseignant : niveau ouvert ou ouvert aux enseignants.
create or replace function public.check_profile_cycle_open()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.education_levels l
    where l.country_code = new.country_code and l.cycle = new.cycle
      and (l.is_open or (new.role = 'enseignant' and l.open_to_teachers))
  ) then
    raise exception 'LULU_NIVEAU_NON_OUVERT';
  end if;
  return new;
end;
$$;

revoke execute on function public.check_profile_cycle_open() from public, anon, authenticated;
