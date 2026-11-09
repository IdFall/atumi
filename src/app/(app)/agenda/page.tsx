import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { EventsView, TimetableView } from "@/components/agenda/agenda-views";
import { getT } from "@/i18n/server";
import { weekdayOf } from "@/lib/agenda";
import { agendaToday, listEvents, listSlots } from "@/server/agenda/queries";
import { listModules } from "@/server/courses/queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: `${t.agenda.title} · ${t.app.name}` };
}

/** Agenda de l'élève : échéances (devoirs, examens) et emploi du temps de la semaine. */
export default async function AgendaPage({ searchParams }: PageProps<"/agenda">) {
  const t = await getT();
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-5 px-4 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">{t.agenda.title}</h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-300">{t.agenda.intro}</p>
      </header>
      <Suspense fallback={<p>{t.dashboard.loading}</p>}>
        <AgendaLoader searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function AgendaLoader({ searchParams }: { searchParams: PageProps<"/agenda">["searchParams"] }) {
  const t = await getT();
  const query = await searchParams;
  const tab = query.vue === "semaine" ? "timetable" : "events";
  const [today, modules] = await Promise.all([agendaToday(), listModules()]);
  const options = modules.map((m) => ({ id: m.id, name: m.name }));

  return (
    <>
      <nav aria-label={t.agenda.title} className="grid grid-cols-2 gap-1 rounded-xl bg-neutral-100 p-1 dark:bg-neutral-900">
        {(["events", "timetable"] as const).map((key) => (
          <Link
            key={key}
            href={key === "events" ? "/agenda" : "/agenda?vue=semaine"}
            aria-current={tab === key ? "page" : undefined}
            className={`rounded-lg px-3 py-2 text-center text-sm font-semibold ${
              tab === key ? "bg-white text-primary shadow-sm dark:bg-neutral-800 dark:text-lavande" : "text-neutral-600 dark:text-neutral-300"
            }`}
          >
            {t.agenda.tabs[key]}
          </Link>
        ))}
      </nav>
      {tab === "events" ? (
        <EventsView events={await listEvents(today)} today={today} modules={options} />
      ) : (
        <TimetableView slots={await listSlots()} todayWeekday={weekdayOf(today)} modules={options} />
      )}
    </>
  );
}
