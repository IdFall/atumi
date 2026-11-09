import { z } from "zod";

import type { AgendaErrorKey } from "@/i18n/messages";

export const EVENT_KINDS = ["devoir", "examen", "autre"] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

const optionalUuid = z.union([z.literal(""), z.uuid()]).transform((v) => (v === "" ? null : v));
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

const eventSchema = z.object({
  kind: z.enum(EVENT_KINDS),
  title: z.string().trim().min(1).max(200),
  dueOn: z.iso.date(),
  dueTime: z.union([z.literal(""), time]).transform((v) => (v === "" ? null : v)),
  moduleId: optionalUuid,
  note: z.string().trim().max(1000).transform((v) => (v === "" ? null : v)),
});

const slotSchema = z
  .object({
    weekday: z.coerce.number().int().min(1).max(7),
    startsAt: time,
    endsAt: time,
    label: z.string().trim().min(1).max(120),
    place: z.string().trim().max(80).transform((v) => (v === "" ? null : v)),
    moduleId: optionalUuid,
  })
  .refine((s) => s.endsAt > s.startsAt, { path: ["endsAt"] });

export type EventInput = z.infer<typeof eventSchema>;
export type SlotInput = z.infer<typeof slotSchema>;

type Parsed<T> = { ok: true; value: T } | { ok: false; error: AgendaErrorKey };

export function parseEvent(raw: Record<string, string>): Parsed<EventInput> {
  const parsed = eventSchema.safeParse(raw);
  if (parsed.success) return { ok: true, value: parsed.data };
  const path = parsed.error.issues[0]?.path[0];
  return { ok: false, error: path === "title" ? "titleRequired" : path === "dueOn" ? "dateRequired" : "unknown" };
}

export function parseSlot(raw: Record<string, string>): Parsed<SlotInput> {
  const parsed = slotSchema.safeParse(raw);
  if (parsed.success) return { ok: true, value: parsed.data };
  const path = parsed.error.issues[0]?.path[0];
  return {
    ok: false,
    error: path === "label" ? "labelRequired" : path === "startsAt" || path === "endsAt" ? "timeOrder" : "unknown",
  };
}
