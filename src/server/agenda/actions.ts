"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { AgendaErrorKey } from "@/i18n/messages";
import { createUserClient } from "@/lib/supabase/server";
import { requireUserId } from "@/server/auth/session";

import { parseEvent, parseSlot } from "./schemas";

/** Agenda et emploi du temps : écritures avec le client utilisateur (RLS). */

export interface AgendaFormState {
  error?: AgendaErrorKey;
  saved?: boolean;
}

const EVENT_FIELDS = ["kind", "title", "dueOn", "dueTime", "moduleId", "note"] as const;
const SLOT_FIELDS = ["weekday", "startsAt", "endsAt", "label", "place", "moduleId"] as const;

function fields(formData: FormData, names: readonly string[]): Record<string, string> {
  return Object.fromEntries(
    names.map((name) => {
      const value = formData.get(name);
      return [name, typeof value === "string" ? value : ""];
    }),
  );
}

/** Identifiant facultatif : présent pour une modification, absent pour un ajout. */
function idOf(formData: FormData): string | null | undefined {
  const value = formData.get("id");
  if (typeof value !== "string" || value === "") return null;
  const parsed = z.uuid().safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

function refresh() {
  revalidatePath("/agenda");
  revalidatePath("/tableau-de-bord");
}

export async function saveEventAction(_prev: AgendaFormState, formData: FormData): Promise<AgendaFormState> {
  const userId = await requireUserId();
  const id = idOf(formData);
  if (id === undefined) return { error: "unknown" };
  const parsed = parseEvent(fields(formData, EVENT_FIELDS));
  if (!parsed.ok) return { error: parsed.error };
  const e = parsed.value;
  const row = { kind: e.kind, title: e.title, due_on: e.dueOn, due_time: e.dueTime, module_id: e.moduleId, note: e.note };

  const supabase = await createUserClient();
  const { error } = id
    ? await supabase.from("agenda_events").update(row).eq("id", id)
    : await supabase.from("agenda_events").insert({ ...row, user_id: userId });
  if (error) return { error: "unknown" };
  refresh();
  return { saved: true };
}

export async function setEventDoneAction(_prev: AgendaFormState, formData: FormData): Promise<AgendaFormState> {
  await requireUserId();
  const id = idOf(formData);
  if (!id) return { error: "unknown" };
  const done = formData.get("done") === "true";
  const supabase = await createUserClient();
  const { error } = await supabase
    .from("agenda_events")
    .update({ done_at: done ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) return { error: "unknown" };
  refresh();
  return { saved: true };
}

export async function saveSlotAction(_prev: AgendaFormState, formData: FormData): Promise<AgendaFormState> {
  const userId = await requireUserId();
  const id = idOf(formData);
  if (id === undefined) return { error: "unknown" };
  const parsed = parseSlot(fields(formData, SLOT_FIELDS));
  if (!parsed.ok) return { error: parsed.error };
  const s = parsed.value;
  const row = { weekday: s.weekday, starts_at: s.startsAt, ends_at: s.endsAt, label: s.label, place: s.place, module_id: s.moduleId };

  const supabase = await createUserClient();
  const { error } = id
    ? await supabase.from("timetable_slots").update(row).eq("id", id)
    : await supabase.from("timetable_slots").insert({ ...row, user_id: userId });
  if (error) return { error: "unknown" };
  refresh();
  return { saved: true };
}

/** Supprime une échéance (`kind=event`) ou un créneau (`kind=slot`). */
export async function deleteAgendaItemAction(_prev: AgendaFormState, formData: FormData): Promise<AgendaFormState> {
  await requireUserId();
  const id = idOf(formData);
  if (!id) return { error: "unknown" };
  const table = formData.get("kind") === "slot" ? "timetable_slots" : "agenda_events";
  const supabase = await createUserClient();
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) return { error: "unknown" };
  refresh();
  return {};
}
