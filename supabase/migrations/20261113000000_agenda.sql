-- Agenda et emploi du temps de l'élève (Idrissa, 2026-11-09, « V1 simple »).
--
--   * agenda_events : devoirs, examens et autres échéances datées, saisis par l'élève,
--     cochés quand c'est fait. Les rappels sont calculés par l'interface (à venir, en retard).
--   * timetable_slots : créneaux de la semaine (jour, heure de début et de fin, matière).
--
-- Date et heure sont gardées telles que l'élève les a saisies (heure locale de son pays) :
-- pas de fuseau à convertir. Un module supprimé laisse l'échéance, sans lien.

create table public.agenda_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('devoir', 'examen', 'autre')),
  title text not null check (char_length(title) between 1 and 200),
  module_id uuid,
  due_on date not null,
  due_time time,
  note text check (char_length(note) <= 1000),
  done_at timestamptz,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (module_id, user_id) references public.modules (id, user_id) on delete set null (module_id)
);

create index agenda_events_user_due on public.agenda_events (user_id, due_on);

create table public.timetable_slots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- 1 = lundi … 7 = dimanche (ISO 8601).
  weekday smallint not null check (weekday between 1 and 7),
  starts_at time not null,
  ends_at time not null,
  label text not null check (char_length(label) between 1 and 120),
  place text check (char_length(place) <= 80),
  module_id uuid,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  unique (id, user_id),
  foreign key (module_id, user_id) references public.modules (id, user_id) on delete set null (module_id)
);

create index timetable_slots_user_day on public.timetable_slots (user_id, weekday, starts_at);

alter table public.agenda_events enable row level security;
alter table public.timetable_slots enable row level security;

create policy "propriétaire" on public.agenda_events
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "propriétaire" on public.timetable_slots
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
