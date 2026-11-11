"use client";

import Link from "next/link";

import { useT } from "@/i18n/client";
import { shortTime } from "@/lib/agenda";
import type { AgendaEvent } from "@/server/agenda/queries";

import { ReminderBadge, useDayLabel } from "./agenda-views";

/** Rappels de l'accueil : échéances en retard et des 7 prochains jours. */
export function AgendaReminders({ events, today }: { events: AgendaEvent[]; today: string }) {
  const t = useT();
  const dayLabel = useDayLabel();
  if (events.length === 0) return null;
  const shown = events.slice(0, 4);
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-orange-200 bg-orange-50/60 p-4 dark:border-orange-900 dark:bg-orange-950/30">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">{t.dashboard.reminders}</h2>
        <Link href="/agenda" className="text-sm font-medium text-primary dark:text-lavande">
          {t.dashboard.seeAgenda}
        </Link>
      </div>
      <ul className="flex flex-col gap-2">
        {shown.map((e) => (
          <li key={e.id} className="flex items-start justify-between gap-3 text-sm">
            <div className="min-w-0">
              <p className="font-semibold">
                {t.agenda.kinds[e.kind]} · {e.title}
              </p>
              <p className="text-neutral-600 dark:text-neutral-300">
                {dayLabel(e.dueOn)}
                {e.dueTime ? ` · ${shortTime(e.dueTime)}` : ""}
              </p>
            </div>
            <ReminderBadge event={e} today={today} />
          </li>
        ))}
      </ul>
    </section>
  );
}
