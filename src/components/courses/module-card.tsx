import Link from "next/link";

import { getMessages } from "@/i18n/messages";
import type { ModuleSummary } from "@/server/courses/queries";
import { studyPath } from "@/server/study/paths";

const t = getMessages("fr");

export function plural(count: number, words: { one: string; other: string }): string {
  return `${count} ${count > 1 ? words.other : words.one}`;
}

export function ModuleCard({ module }: { module: ModuleSummary }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4 hover:border-primary dark:border-neutral-800 dark:bg-neutral-900">
      <Link href={`/cours/${module.id}`} className="flex flex-col gap-1">
        <span className="flex items-center justify-between gap-3">
          <strong className="text-base">{module.name}</strong>
          <span aria-hidden="true" className="text-primary dark:text-lavande">
            ›
          </span>
        </span>
        <span className="text-sm text-neutral-600 dark:text-neutral-300">
          {plural(module.chapterCount, t.courses.chapters)} · {plural(module.documentCount, t.courses.documents)}
        </span>
        {module.chapters.length > 0 ? (
          <span className="truncate text-sm text-neutral-500">{module.chapters.map((c) => c.title).join(" · ")}</span>
        ) : null}
      </Link>
      <NextStepAction module={module} />
    </div>
  );
}

/** Indicateur de l'étape suivante, avec un bouton quand une action est possible. */
function NextStepAction({ module }: { module: ModuleSummary }) {
  const step = t.courses.nextStep;
  switch (module.next.kind) {
    case "study":
      return (
        <div className="flex flex-col gap-2 border-t border-neutral-100 pt-3 dark:border-neutral-800">
          <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-green-700 dark:text-green-400">
            <span aria-hidden="true" className="h-2 w-2 rounded-full bg-green-600" />
            {step.studyLabel}
          </span>
          <Link
            href={studyPath(module.id, module.next.chapterId)}
            className="rounded-xl bg-primary px-4 py-2.5 text-center font-semibold text-white hover:bg-primary-strong"
          >
            {step.studyAction} ›
          </Link>
        </div>
      );
    case "reading":
      return (
        <div className="flex flex-col gap-1 border-t border-neutral-100 pt-3 dark:border-neutral-800" role="status">
          <span className="flex items-center gap-2 text-sm font-semibold text-nuit dark:text-lavande">
            <span aria-hidden="true" className="h-2 w-2 animate-pulse rounded-full bg-accent" />
            {step.readingLabel}
          </span>
          <span className="text-xs text-neutral-500">{step.readingHint}</span>
        </div>
      );
    case "import":
      return (
        <div className="flex flex-col gap-2 border-t border-neutral-100 pt-3 dark:border-neutral-800">
          <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{step.importLabel}</span>
          <Link
            href={`/importer?module=${module.id}`}
            className="rounded-xl border border-primary px-4 py-2.5 text-center font-semibold text-primary hover:bg-primary-soft dark:text-lavande"
          >
            {step.importAction}
          </Link>
        </div>
      );
  }
}
