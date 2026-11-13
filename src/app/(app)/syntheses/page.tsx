import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { DeleteStudyButton } from "@/components/study/delete-study-button";
import { fill } from "@/i18n/format";
import { DATE_LOCALES } from "@/i18n/messages";
import { getLocale, getT } from "@/i18n/server";
import { studyPath } from "@/server/study/paths";
import { listMySyntheses } from "@/server/study/queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: `${t.synthesisList.title} · ${t.app.name}` };
}

/** Mes synthèses : la synthèse de chaque chapitre (ou module), à ouvrir ou à supprimer. */
export default async function SynthesisListPage() {
  const t = await getT();
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">{t.synthesisList.title}</h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-300">{t.synthesisList.intro}</p>
      </header>
      <Suspense fallback={<p>{t.dashboard.loading}</p>}>
        <SynthesisList />
      </Suspense>
    </main>
  );
}

async function SynthesisList() {
  const [t, locale, syntheses] = await Promise.all([getT(), getLocale(), listMySyntheses()]);
  const s = t.synthesisList;
  if (syntheses.length === 0) {
    return (
      <section className="flex flex-col items-start gap-3 rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <p className="text-sm text-neutral-600 dark:text-neutral-300">{s.empty}</p>
        <Link href="/cours" className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white">
          {s.toCourses}
        </Link>
      </section>
    );
  }
  const dateOf = (iso: string) => new Date(iso).toLocaleDateString(DATE_LOCALES[locale], { day: "numeric", month: "long" });
  return (
    <ul className="flex flex-col gap-2">
      {syntheses.map((item) => {
        const name = item.chapterTitle ?? item.moduleName;
        const status = item.status === "generating" ? s.preparing : item.status === "failed" ? s.failed : s.ready;
        return (
          <li
            key={item.id}
            className="flex flex-col gap-2 rounded-xl border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900"
          >
            <div className="flex items-center gap-3">
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span title={name} className="line-clamp-2 break-words font-semibold">
                  {name}
                </span>
                <span className="text-xs text-neutral-600 dark:text-neutral-300">
                  {item.chapterTitle ? item.moduleName : s.wholeModule} · {fill(s.updated, { date: dateOf(item.updatedAt) })} · {status}
                </span>
              </div>
              <Link
                href={studyPath(item.moduleId, item.chapterId)}
                className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-white"
              >
                {s.open}
              </Link>
            </div>
            {item.status === "generating" ? null : (
              <DeleteStudyButton kind="synthesis" id={item.id} warning={fill(t.studyDelete.synthesisWarning, { name })} />
            )}
          </li>
        );
      })}
    </ul>
  );
}
