import type { Reminder } from "./agenda";
import type { NextStep } from "./next-step";

/**
 * « Ta prochaine mission » sur l'accueil : une seule chose à faire maintenant,
 * choisie dans l'agenda et dans les cours de l'élève (sans appel au modèle).
 * Ordre : échéance en retard, échéance aujourd'hui ou demain, cours prêt à
 * réviser, cours en lecture, sinon importer un premier cours.
 */
export type Mission =
  | { kind: "overdue" | "dueSoon"; title: string; href: string }
  | { kind: "study" | "reading"; title: string; href: string }
  | { kind: "import"; title: null; href: string };

export function nextMission(
  modules: readonly { id: string; name: string; next: NextStep }[],
  reminders: readonly { title: string; reminder: Reminder }[],
): Mission {
  const overdue = reminders.find((r) => r.reminder === "overdue");
  if (overdue) return { kind: "overdue", title: overdue.title, href: "/agenda" };
  const soon = reminders.find((r) => r.reminder === "today" || r.reminder === "tomorrow");
  if (soon) return { kind: "dueSoon", title: soon.title, href: "/agenda" };
  const study = modules.find((m) => m.next.kind === "study");
  if (study) return { kind: "study", title: study.name, href: `/cours/${study.id}` };
  const reading = modules.find((m) => m.next.kind === "reading");
  if (reading) return { kind: "reading", title: reading.name, href: `/cours/${reading.id}` };
  return { kind: "import", title: null, href: "/importer" };
}
