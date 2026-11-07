import Link from "next/link";

import { getMessages } from "@/i18n/messages";
import type { ModuleSummary } from "@/server/courses/queries";

const t = getMessages("fr");

export function plural(count: number, words: { one: string; other: string }): string {
  return `${count} ${count > 1 ? words.other : words.one}`;
}

export function ModuleCard({ module }: { module: ModuleSummary }) {
  return (
    <Link
      href={`/cours/${module.id}`}
      className="flex flex-col gap-1 rounded-xl border border-neutral-200 bg-white p-4 hover:border-amber-600 dark:border-neutral-800 dark:bg-neutral-900"
    >
      <span className="flex items-center justify-between gap-3">
        <strong className="text-base">{module.name}</strong>
        <span aria-hidden="true" className="text-amber-700">
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
  );
}
