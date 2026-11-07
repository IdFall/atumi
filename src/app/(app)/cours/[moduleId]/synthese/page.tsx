import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { PendingRefresh } from "@/components/courses/pending-refresh";
import { StudyActionButton } from "@/components/study/action-button";
import { ShareActions } from "@/components/study/share-actions";
import { SynthesisContent } from "@/components/study/synthesis-content";
import { fill } from "@/i18n/format";
import { getMessages } from "@/i18n/messages";
import { requestSynthesisAction, startQuizAction } from "@/server/study/actions";
import { getStudyPage, type StudyPage } from "@/server/study/queries";

const t = getMessages("fr");

export const metadata: Metadata = { title: `${t.study.synthesisTitle} · ${t.app.name}` };

type Props = PageProps<"/cours/[moduleId]/synthese">;

export default function SynthesisPage({ params, searchParams }: Props) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-5 px-4 py-8">
      <Suspense fallback={<p>{t.dashboard.loading}</p>}>
        <Synthesis params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Synthesis({ params, searchParams }: Pick<Props, "params" | "searchParams">) {
  const [{ moduleId }, query] = await Promise.all([params, searchParams]);
  const chapterId = typeof query.chapitre === "string" ? query.chapitre : null;
  const page = await getStudyPage(moduleId, chapterId);
  if (!page) return <p className="text-neutral-600 dark:text-neutral-300">{t.courses.notFound}</p>;

  const generating = page.synthesis?.status === "generating" || page.pendingDocuments > 0;
  const chapterParam = page.chapter?.id ?? null;

  return (
    <>
      <PendingRefresh active={generating} />
      <Link href={`/cours/${page.moduleId}`} className="text-sm text-amber-700">
        ← {page.moduleName}
      </Link>
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">{page.chapter?.title ?? t.study.wholeModule}</h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-300">{t.study.synthesisTitle}</p>
      </header>

      <SynthesisBlock page={page} chapterId={chapterParam} />

      {page.readyDocuments > 0 ? <QuizBlock page={page} chapterId={chapterParam} /> : null}

      {page.readyDocuments > 0 && chapterParam ? (
        <Link
          href={`/professeur?mode=expliquer&module=${page.moduleId}&chapitre=${chapterParam}`}
          className="rounded-xl border border-neutral-300 px-4 py-3 text-center font-medium dark:border-neutral-700"
        >
          {t.study.askTutor}
        </Link>
      ) : null}
    </>
  );
}

function SynthesisBlock({ page, chapterId }: { page: StudyPage; chapterId: string | null }) {
  const s = page.synthesis;
  const card = "flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900";

  if (page.readyDocuments === 0 && s?.status !== "ready") {
    return <p className={`${card} text-sm text-neutral-600 dark:text-neutral-300`}>{t.study.synthesisNoDocument}</p>;
  }
  if (!s || s.status === "failed") {
    return (
      <div className={card}>
        <p className="text-sm text-neutral-600 dark:text-neutral-300">{s ? (s.errorMessage ?? t.study.synthesisFailed) : t.study.synthesisNone}</p>
        <StudyActionButton
          action={requestSynthesisAction}
          moduleId={page.moduleId}
          chapterId={chapterId}
          label={s ? t.study.synthesisRetry : t.study.synthesisCreate}
          variant="secondary"
        />
      </div>
    );
  }
  if (s.status === "generating") {
    return (
      <p role="status" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
        {t.study.synthesisPending}
      </p>
    );
  }
  return (
    <article className={card}>
      <p className="text-xs text-neutral-500">{t.study.sourceNotice}</p>
      <SynthesisContent markdown={s.contentMd} />
      <ShareActions title={`${page.chapter?.title ?? page.moduleName} · ${t.study.synthesisTitle}`} markdown={s.contentMd} />
      {s.outdated ? (
        <div className="flex flex-col gap-2 border-t border-neutral-100 pt-3 dark:border-neutral-800">
          <p className="text-sm text-neutral-600 dark:text-neutral-300">{t.study.synthesisOutdated}</p>
          <StudyActionButton
            action={requestSynthesisAction}
            moduleId={page.moduleId}
            chapterId={chapterId}
            label={t.study.synthesisRefresh}
            variant="secondary"
          />
        </div>
      ) : null}
    </article>
  );
}

function QuizBlock({ page, chapterId }: { page: StudyPage; chapterId: string | null }) {
  const quota = page.quizQuota;
  if (!quota) return <p className="text-sm text-neutral-600 dark:text-neutral-300">{t.access.expired}</p>;
  if (quota.remaining === 0) return <p className="text-sm text-neutral-600 dark:text-neutral-300">{t.study.quizNoneLeft}</p>;
  return (
    <section className="flex flex-col gap-2">
      <p className="text-sm text-neutral-600 dark:text-neutral-300">
        {quota.limit === null
          ? t.study.quizUnlimited
          : fill(t.study.quizRemaining, { n: quota.remaining ?? 0, total: quota.limit })}
      </p>
      <StudyActionButton action={startQuizAction} moduleId={page.moduleId} chapterId={chapterId} label={t.study.quizStart} />
    </section>
  );
}
