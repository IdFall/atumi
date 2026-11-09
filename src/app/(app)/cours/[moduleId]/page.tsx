import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { z } from "zod";

import { InlineCreateForm } from "@/components/courses/inline-create-form";
import { plural } from "@/components/courses/module-card";
import { PendingRefresh } from "@/components/courses/pending-refresh";
import { getMessages } from "@/i18n/messages";
import { createChapterAction } from "@/server/courses/actions";
import { studyPath } from "@/server/study/paths";
import { getModule, type ModuleDocument } from "@/server/courses/queries";

const t = getMessages("fr");

export const metadata: Metadata = { title: `${t.courses.title} · ${t.app.name}` };

export default function ModulePage({ params }: PageProps<"/cours/[moduleId]">) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-8">
      <Link href="/cours" className="text-sm text-primary dark:text-lavande">
        ← {t.courses.back}
      </Link>
      <Suspense fallback={<p>{t.dashboard.loading}</p>}>
        <ModuleDetail params={params} />
      </Suspense>
    </main>
  );
}

async function ModuleDetail({ params }: { params: PageProps<"/cours/[moduleId]">["params"] }) {
  const { moduleId } = await params;
  const detail = z.uuid().safeParse(moduleId).success ? await getModule(moduleId) : null;
  if (!detail) return <p className="text-neutral-600 dark:text-neutral-300">{t.courses.notFound}</p>;

  const all = [...detail.chapters.flatMap((c) => c.documents), ...detail.unassigned];
  const pending = all.some((d) => d.status === "uploaded" || d.status === "processing");

  return (
    <>
      <PendingRefresh active={pending} />
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">{detail.name}</h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-300">
          {plural(detail.chapters.length, t.courses.chapters)} · {plural(all.length, t.courses.documents)}
        </p>
      </header>

      {all.some((d) => d.status === "ready") ? (
        <p role="status" className="rounded-xl border border-primary/30 bg-primary-soft px-4 py-3 text-sm font-medium text-nuit dark:bg-primary-strong/25 dark:text-lavande">
          {t.courses.nextStep.moduleHint}
        </p>
      ) : null}

      <Link
        href={`/importer?module=${detail.id}`}
        className="rounded-xl bg-primary px-4 py-3 text-center font-semibold text-white"
      >
        {t.courses.importHere}
      </Link>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{t.courses.moduleChapters}</h2>
        {detail.chapters.length === 0 ? (
          <p className="text-sm text-neutral-600 dark:text-neutral-300">{t.courses.noChapter}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {detail.chapters.map((chapter) => (
              <li key={chapter.id} className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
                <div className="flex items-baseline justify-between gap-3">
                  <strong>{chapter.title}</strong>
                  <Link href={`/importer?module=${detail.id}&chapitre=${chapter.id}`} className="text-sm font-medium text-primary dark:text-lavande">
                    {t.nav.import}
                  </Link>
                </div>
                {chapter.documents.some((d) => d.status === "ready") ? (
                  <Link
                    href={studyPath(detail.id, chapter.id)}
                    className="mt-3 block rounded-xl bg-primary px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-primary-strong"
                  >
                    {t.courses.nextStep.studyAction} ›
                  </Link>
                ) : null}
                <DocumentList documents={chapter.documents} />
              </li>
            ))}
          </ul>
        )}
        <InlineCreateForm
          action={createChapterAction}
          fieldName="title"
          label={t.courses.newChapterTitle}
          placeholder={t.courses.newChapterPlaceholder}
          hidden={{ moduleId: detail.id }}
        />
      </section>

      {detail.unassigned.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">{t.courses.withoutChapter}</h2>
          <DocumentList documents={detail.unassigned} />
          {all.some((d) => d.status === "ready") ? (
            <Link href={studyPath(detail.id, null)} className="text-sm font-semibold text-primary dark:text-lavande">
              {t.study.openSynthesis} ({t.study.wholeModule.toLowerCase()}) ›
            </Link>
          ) : null}
        </section>
      ) : null}
    </>
  );
}

const STATUS_STYLES = {
  uploaded: "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200",
  processing: "bg-primary-soft text-nuit dark:bg-primary-strong/25 dark:text-lavande",
  ready: "bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-100",
  failed: "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-100",
} as const;

function DocumentList({ documents }: { documents: ModuleDocument[] }) {
  if (documents.length === 0) {
    return <p className="mt-2 text-sm text-neutral-500">{t.courses.noDocument}</p>;
  }
  return (
    <ul className="mt-2 flex flex-col gap-2">
      {documents.map((d) => (
        <li key={d.id} className="flex flex-col gap-1 text-sm">
          <span className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate">
              {d.title}
              <span className="text-neutral-500">
                {" "}
                · {t.courses.kinds[d.kind]}
                {d.pageCount ? ` · ${d.pageCount} ${t.courses.pages}` : ""}
              </span>
            </span>
            <span className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[d.status]}`}>
              {t.courses.status[d.status]}
            </span>
          </span>
          {d.status === "failed" && d.errorMessage ? (
            <span className="text-red-700 dark:text-red-400">{d.errorMessage}</span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
