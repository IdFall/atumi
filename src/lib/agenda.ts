/**
 * Calculs de l'agenda, sans accès à la base : date du jour dans le fuseau du
 * pays, état de rappel d'une échéance, regroupement de l'emploi du temps.
 * Les dates sont des chaînes « AAAA-MM-JJ » saisies par l'élève (heure locale).
 */

export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export const WEEKDAYS: readonly Weekday[] = [1, 2, 3, 4, 5, 6, 7];

/** Date du jour (« AAAA-MM-JJ ») dans un fuseau horaire IANA. */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** Jour de la semaine ISO (1 = lundi … 7 = dimanche) d'une date « AAAA-MM-JJ ». */
export function weekdayOf(date: string): Weekday {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return (day === 0 ? 7 : day) as Weekday;
}

/** Nombre de jours de `from` à `to` (négatif si `to` est passé). */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

export type Reminder = "done" | "overdue" | "today" | "tomorrow" | "soon" | "later";

/** « Bientôt » = dans les 7 prochains jours. */
export const SOON_DAYS = 7;

export function reminderOf(event: { dueOn: string; done: boolean }, today: string): Reminder {
  if (event.done) return "done";
  const days = daysBetween(today, event.dueOn);
  if (days < 0) return "overdue";
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return days <= SOON_DAYS ? "soon" : "later";
}

/** Rappels à montrer à l'accueil : en retard, puis les 7 prochains jours. */
export function needsReminder(reminder: Reminder): boolean {
  return reminder === "overdue" || reminder === "today" || reminder === "tomorrow" || reminder === "soon";
}

/** Créneaux regroupés par jour, dans l'ordre de la semaine puis de l'heure. */
export function slotsByDay<T extends { weekday: Weekday; startsAt: string }>(slots: readonly T[]): { weekday: Weekday; slots: T[] }[] {
  return WEEKDAYS.map((weekday) => ({
    weekday,
    slots: slots.filter((s) => s.weekday === weekday).sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
  })).filter((day) => day.slots.length > 0);
}

/** « 08:00:00 » (Postgres) → « 08:00 ». */
export function shortTime(value: string | null): string | null {
  return value ? value.slice(0, 5) : null;
}
