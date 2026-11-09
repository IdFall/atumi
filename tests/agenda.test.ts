import { describe, expect, it } from "vitest";

import {
  daysBetween,
  needsReminder,
  reminderOf,
  shortTime,
  slotsByDay,
  timetableText,
  todayIn,
  weekdayOf,
  whatsappShareUrl,
} from "@/lib/agenda";

describe("agenda", () => {
  it("donne la date du jour dans le fuseau du pays", () => {
    const lateEvening = new Date("2026-11-09T23:30:00Z");
    expect(todayIn("Africa/Dakar", lateEvening)).toBe("2026-11-09");
    expect(todayIn("Africa/Douala", lateEvening)).toBe("2026-11-10");
  });

  it("calcule le jour de la semaine et les écarts", () => {
    expect(weekdayOf("2026-11-09")).toBe(1); // lundi
    expect(weekdayOf("2026-11-15")).toBe(7); // dimanche
    expect(daysBetween("2026-11-09", "2026-11-12")).toBe(3);
    expect(daysBetween("2026-11-09", "2026-11-01")).toBe(-8);
  });

  it("classe les échéances pour les rappels", () => {
    const today = "2026-11-09";
    expect(reminderOf({ dueOn: "2026-11-08", done: false }, today)).toBe("overdue");
    expect(reminderOf({ dueOn: "2026-11-08", done: true }, today)).toBe("done");
    expect(reminderOf({ dueOn: today, done: false }, today)).toBe("today");
    expect(reminderOf({ dueOn: "2026-11-10", done: false }, today)).toBe("tomorrow");
    expect(reminderOf({ dueOn: "2026-11-16", done: false }, today)).toBe("soon");
    expect(reminderOf({ dueOn: "2026-11-17", done: false }, today)).toBe("later");
    expect(needsReminder("overdue")).toBe(true);
    expect(needsReminder("later")).toBe(false);
    expect(needsReminder("done")).toBe(false);
  });

  it("range l'emploi du temps par jour puis par heure", () => {
    const days = slotsByDay([
      { weekday: 3, startsAt: "10:00:00", label: "Physique" },
      { weekday: 1, startsAt: "14:00:00", label: "Anglais" },
      { weekday: 1, startsAt: "08:00:00", label: "Maths" },
    ]);
    expect(days.map((d) => [d.weekday, d.slots.map((s) => s.label)])).toEqual([
      [1, ["Maths", "Anglais"]],
      [3, ["Physique"]],
    ]);
    expect(shortTime("08:00:00")).toBe("08:00");
    expect(shortTime(null)).toBeNull();
  });

  it("prépare l'emploi du temps à partager sur WhatsApp", () => {
    const names = { 1: "Lundi", 2: "Mardi" } as Record<number, string>;
    const text = timetableText(
      "Mon emploi du temps",
      [
        { weekday: 2, startsAt: "08:00:00", endsAt: "11:00:00", label: "Physique", place: "Labo" },
        { weekday: 1, startsAt: "08:00:00", endsAt: "10:00:00", label: "Maths", place: null },
      ],
      (d) => names[d],
    );
    expect(text).toBe("Mon emploi du temps\n\n*Lundi*\n08:00–10:00 Maths\n\n*Mardi*\n08:00–11:00 Physique (Labo)");
    expect(whatsappShareUrl("a b&c")).toBe("https://wa.me/?text=a%20b%26c");
  });
});
