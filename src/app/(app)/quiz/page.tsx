import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { fill } from "@/i18n/format";
import { DATE_LOCALES } from "@/i18n/messages";
import { getLocale, getT } from "@/i18n/server";
import { DeleteStudyButton } from "@/components/study/delete-study-button";
import { closeChallengeAction } from "@/server/challenges/actions";
import { listMyQuizzes, type MyQuizItem } from "@/server/challenges/queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: `${t.quizList.title} · ${t.app.name}` };
}

/** Mes quiz : tous les quiz de l'élève, sa note et les liens WhatsApp encore ouverts (à arrêter). */
export default async function QuizListPage() {
  const t = await getT();
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">{t.quizList.title}</h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-300">{t.quizList.intro}</p>
      </header>
      <Suspense fallback={<p>{t.dashboard.loading}</p>}>
        <QuizList />
      </Suspense>
    </main>
  );
}

async function QuizList() {
  const [t, locale, quizzes] = await Promise.all([getT(), getLocale(), listMyQuizzes()]);
  const q = t.quizList;
  if (quizzes.length === 0) {
    return (
      <section className="flex flex-col items-start gap-3 rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <p className="text-sm text-neutral-600 dark:text-neutral-300">{q.empty}</p>
        <Link href="/cours" className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white">
          {q.toCourses}
        </Link>
      </section>
    );
  }
  const dateOf = (iso: string) => new Date(iso).toLocaleDateString(DATE_LOCALES[locale], { day: "numeric", month: "long" });
  const shared = quizzes.filter((quiz) => quiz.challenge?.open);
  const others = quizzes.filter((quiz) => !quiz.challenge?.open);
  return (
    <>
      {shared.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-base font-semibold">{q.sharedTitle}</h2>
          <ul className="flex flex-col gap-2">
            {shared.map((quiz) => (
              <QuizRow key={quiz.id} quiz={quiz} dateOf={dateOf} />
            ))}
          </ul>
        </section>
      ) : null}
      {others.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-base font-semibold">{shared.length > 0 ? q.otherTitle : q.allTitle}</h2>
          <ul className="flex flex-col gap-2">
            {others.map((quiz) => (
              <QuizRow key={quiz.id} quiz={quiz} dateOf={dateOf} />
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}

async function QuizRow({ quiz, dateOf }: { quiz: MyQuizItem; dateOf: (iso: string) => string }) {
  const t = await getT();
  const q = t.quizList;
  const status =
    quiz.status === "generating"
      ? q.preparing
      : quiz.status === "failed"
        ? q.failed
        : quiz.result
          ? fill(q.mark, { correct: quiz.result.correct, total: quiz.result.total })
          : q.toTake;
  const c = quiz.challenge;
  const link = !c
    ? q.noLink
    : c.correctionPublished
      ? fill(q.correctionPublished, { n: c.plays })
      : c.open
        ? fill(q.linkOpen, { date: dateOf(c.expiresAt), n: c.plays })
        : fill(q.linkClosed, { n: c.plays });
  // Une préparation en cours n'est pas supprimable : le worker écrit encore le quiz.
  const running = quiz.status === "generating";
  return (
    <li className="flex flex-col gap-2 rounded-xl border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span title={quiz.subject} className="line-clamp-2 break-words font-semibold">
            {quiz.subject || t.quiz.title}
          </span>
          <span className="text-xs text-neutral-600 dark:text-neutral-300">
            {dateOf(quiz.createdAt)} · {status}
          </span>
          <span className={`text-xs ${c?.open ? "font-medium text-green-700 dark:text-green-400" : "text-neutral-500 dark:text-neutral-400"}`}>
            {link}
          </span>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center">
          <Link href={`/quiz/${quiz.id}`} className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-white">
            {q.open}
          </Link>
          {c?.open ? (
            <form action={closeChallengeAction}>
              <input type="hidden" name="challengeId" value={c.id} />
              <input type="hidden" name="quizId" value={quiz.id} />
              <button type="submit" className="rounded-lg px-3 py-1.5 text-sm font-semibold text-red-700 dark:text-red-400">
                {q.stop}
              </button>
            </form>
          ) : null}
        </div>
      </div>
      {running ? null : (
        <DeleteStudyButton
          kind="quiz"
          id={quiz.id}
          warning={fill(t.studyDelete.quizWarning, { name: quiz.subject || t.quiz.title })}
        />
      )}
    </li>
  );
}
