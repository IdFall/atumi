import "server-only";

import { getCountry } from "@/config/countries";
import { needsReminder, reminderOf, todayIn, type Reminder, type Weekday } from "@/lib/agenda";
import { createUserClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/server/auth/session";

import type { EventKind } from "./schemas";

/** Lectures de l'agenda de l'utilisateur connecté (client utilisateur : RLS). */

export interface AgendaEvent {
  id: string;
  kind: EventKind;
  title: string;
  dueOn: string;
  dueTime: string | null;
  moduleId: string | null;
  moduleName: string | null;
  note: string | null;
  done: boolean;
  reminder: Reminder;
}

export interface TimetableSlot {
  id: string;
  weekday: Weekday;
  startsAt: string;
  endsAt: string;
  label: string;
  place: string | null;
  moduleId: string | null;
}

/** Date du jour de l'élève, dans le fuseau de son pays. */
export function todayFor(countryCode: string): string {
  return todayIn(getCountry(countryCode)?.timezone ?? "UTC");
}

export async function agendaToday(): Promise<string> {
  return todayFor((await getCurrentUser()).countryCode);
}

export async function listEvents(today: string): Promise<AgendaEvent[]> {
  const supabase = await createUserClient();
  const { data, error } = await supabase
    .from("agenda_events")
    .select("id, kind, title, due_on, due_time, module_id, note, done_at, modules(name)")
    .order("due_on", { ascending: true })
    .order("due_time", { ascending: true, nullsFirst: true });
  if (error) throw error;
  return (data ?? []).map((e) => {
    const done = e.done_at !== null;
    const linked = e.modules as { name: string } | { name: string }[] | null;
    return {
      id: e.id,
      kind: e.kind as EventKind,
      title: e.title,
      dueOn: e.due_on,
      dueTime: e.due_time,
      moduleId: e.module_id,
      moduleName: (Array.isArray(linked) ? linked[0]?.name : linked?.name) ?? null,
      note: e.note,
      done,
      reminder: reminderOf({ dueOn: e.due_on, done }, today),
    };
  });
}

/** Échéances à rappeler (en retard et 7 prochains jours), pour l'accueil. */
export async function listReminders(today: string): Promise<AgendaEvent[]> {
  return (await listEvents(today)).filter((e) => needsReminder(e.reminder));
}

export async function listSlots(): Promise<TimetableSlot[]> {
  const supabase = await createUserClient();
  const { data, error } = await supabase
    .from("timetable_slots")
    .select("id, weekday, starts_at, ends_at, label, place, module_id")
    .order("weekday")
    .order("starts_at");
  if (error) throw error;
  return (data ?? []).map((s) => ({
    id: s.id,
    weekday: s.weekday as Weekday,
    startsAt: s.starts_at,
    endsAt: s.ends_at,
    label: s.label,
    place: s.place,
    moduleId: s.module_id,
  }));
}
