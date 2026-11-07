-- Langue de réponse du professeur IA, choisie par l'apprenant (français par défaut).
-- Les langues proposées par pays sont dans src/config/countries.ts (tutorLanguages).
alter table public.profiles
  add column tutor_language text not null default 'fr' check (tutor_language in ('fr', 'en', 'wo'));

grant update (tutor_language) on public.profiles to authenticated;
