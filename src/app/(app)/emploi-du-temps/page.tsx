import type { Metadata } from "next";
import { Suspense } from "react";

import { TimetableView } from "@/components/agenda/agenda-views";
import { getT } from "@/i18n/server";
import { weekdayOf } from "@/lib/agenda";
import { agendaToday, listSlots } from "@/server/agenda/queries";
import { listModules } from "@/server/courses/queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: `${t.agenda.timetableTitle} · ${t.app.name}` };
}

/** Emploi du temps de la semaine, à partager sur WhatsApp. */
export default async function TimetablePage() {
  const t = await getT();
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-5 px-4 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">{t.agenda.timetableTitle}</h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-300">{t.agenda.timetableIntro}</p>
      </header>
      <Suspense fallback={<p>{t.dashboard.loading}</p>}>
        <TimetableLoader />
      </Suspense>
    </main>
  );
}

async function TimetableLoader() {
  const [today, modules, slots] = await Promise.all([agendaToday(), listModules(), listSlots()]);
  const options = modules.map((m) => ({ id: m.id, name: m.name }));
  return <TimetableView slots={slots} todayWeekday={weekdayOf(today)} modules={options} />;
}
