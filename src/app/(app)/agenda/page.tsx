import type { Metadata } from "next";
import { Suspense } from "react";

import { EventsView } from "@/components/agenda/agenda-views";
import { getT } from "@/i18n/server";
import { agendaToday, listEvents } from "@/server/agenda/queries";
import { listModules } from "@/server/courses/queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: `${t.agenda.title} · ${t.app.name}` };
}

/** Agenda de l'élève : échéances (devoirs, examens, autres dates). L'emploi du temps a sa page. */
export default async function AgendaPage() {
  const t = await getT();
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-5 px-4 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">{t.agenda.title}</h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-300">{t.agenda.intro}</p>
      </header>
      <Suspense fallback={<p>{t.dashboard.loading}</p>}>
        <AgendaLoader />
      </Suspense>
    </main>
  );
}

async function AgendaLoader() {
  const [today, modules] = await Promise.all([agendaToday(), listModules()]);
  const options = modules.map((m) => ({ id: m.id, name: m.name }));
  return <EventsView events={await listEvents(today)} today={today} modules={options} />;
}
