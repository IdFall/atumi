import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { InlineCreateForm } from "@/components/courses/inline-create-form";
import { ModuleCard } from "@/components/courses/module-card";
import { PendingRefresh } from "@/components/courses/pending-refresh";
import { getT } from "@/i18n/server";
import { createModuleAction } from "@/server/courses/actions";
import { FILE_CATEGORIES } from "@/config/documents";
import { listModules, listMyFiles } from "@/server/courses/queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: `${t.courses.title} · ${t.app.name}` };
}

const HEADER_LINK =
  "rounded-lg border border-primary/30 px-3 py-1.5 text-sm font-semibold text-primary-strong dark:text-lavande";

export default async function CoursesPage() {
  const t = await getT();
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-8">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{t.courses.title}</h1>
        {/* « Mes quiz » et « Mes synthèses » sont dans le menu latéral sur ordinateur ; ces liens servent aussi sur téléphone. */}
        <div className="flex shrink-0 flex-wrap justify-end gap-2">
          <Link href="/syntheses" className={HEADER_LINK}>
            {t.nav.syntheses}
          </Link>
          <Link href="/quiz" className={HEADER_LINK}>
            {t.nav.quizzes}
          </Link>
        </div>
      </div>
      <Suspense fallback={<p>{t.dashboard.loading}</p>}>
        <ModuleList />
      </Suspense>
      <InlineCreateForm action={createModuleAction} fieldName="name" label={t.courses.newModule} placeholder={t.courses.newModulePlaceholder} />
      <Suspense fallback={null}>
        <FilesByType />
      </Suspense>
    </main>
  );
}

async function ModuleList() {
  const t = await getT();
  const modules = await listModules();
  if (modules.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-neutral-300 p-6 text-center text-neutral-600 dark:border-neutral-700 dark:text-neutral-300">
        {t.courses.empty}
      </p>
    );
  }
  return (
    <>
      <PendingRefresh active={modules.some((m) => m.next.kind === "reading")} />
      <ul className="flex flex-col gap-3">
        {modules.map((m) => (
          <li key={m.id}>
            <ModuleCard module={m} />
          </li>
        ))}
      </ul>
    </>
  );
}

/** Mes fichiers : tous les fichiers importés, rangés en PDF, Word et image. */
async function FilesByType() {
  const [t, files] = await Promise.all([getT(), listMyFiles()]);
  if (files.length === 0) return null;
  const f = t.courses.files;
  return (
    <section className="flex flex-col gap-4" aria-labelledby="mes-fichiers">
      <header className="flex flex-col gap-1">
        <h2 id="mes-fichiers" className="text-lg font-bold">
          {f.title}
        </h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-300">{f.intro}</p>
      </header>
      {FILE_CATEGORIES.map((category) => {
        const items = files.filter((file) => file.category === category);
        return (
          <details
            key={category}
            open={items.length > 0}
            className="group rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-semibold">
              <span className="flex items-center gap-2">
                <span aria-hidden="true" className={`rounded-md px-1.5 py-0.5 text-xs font-bold text-white ${BADGE[category]}`}>
                  {BADGE_TEXT[category]}
                </span>
                {f[category]}
              </span>
              <span className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
                {items.length} <span aria-hidden="true" className="inline-block transition-transform group-open:rotate-90">›</span>
              </span>
            </summary>
            {items.length === 0 ? (
              <p className="border-t border-neutral-100 px-4 py-3 text-sm text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">{f.none}</p>
            ) : (
              <ul className="flex flex-col border-t border-neutral-100 dark:border-neutral-800">
                {items.map((file) => (
                  <li key={file.id} className="border-b border-neutral-100 last:border-b-0 dark:border-neutral-800">
                    <Link
                      href={`/cours/${file.moduleId}/document/${file.id}`}
                      className="flex flex-col gap-0.5 px-4 py-2.5 hover:bg-primary-soft dark:hover:bg-primary-strong/20"
                    >
                      <span className="break-words text-sm font-medium">{file.title}</span>
                      <span className="text-xs text-neutral-600 dark:text-neutral-300">
                        {file.chapterTitle ? `${file.moduleName} · ${file.chapterTitle}` : file.moduleName} · {t.courses.status[file.status]}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </details>
        );
      })}
    </section>
  );
}

const BADGE = { pdf: "bg-red-700", word: "bg-blue-700", image: "bg-teal-700" } as const;
const BADGE_TEXT = { pdf: "PDF", word: "DOC", image: "IMG" } as const;
