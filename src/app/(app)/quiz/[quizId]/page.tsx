import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { PendingRefresh } from "@/components/courses/pending-refresh";
import { StudyActionButton } from "@/components/study/action-button";
import { ContestForm } from "@/components/study/contest-form";
import { QuizForm } from "@/components/study/quiz-form";
import { ScoreGauge } from "@/components/study/score-gauge";
import { getT } from "@/i18n/server";
import { startQuizAction } from "@/server/study/actions";
import { studyPath } from "@/server/study/paths";
import { getQuizView, type QuizView } from "@/server/study/queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: `${t.quiz.title} · ${t.app.name}` };
}

export default async function QuizPage({ params }: PageProps<"/quiz/[quizId]">) {
  const t = await getT();
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-5 px-4 py-8">
      <Suspense fallback={<p>{t.dashboard.loading}</p>}>
        <Quiz params={params} />
      </Suspense>
    </main>
  );
}

async function Quiz({ params }: { params: PageProps<"/quiz/[quizId]">["params"] }) {
  const t = await getT();
  const { quizId } = await params;
  const quiz = await getQuizView(quizId);
  if (!quiz) return <p className="text-neutral-600 dark:text-neutral-300">{t.quiz.notFoundQuiz}</p>;
  const back = studyPath(quiz.moduleId, quiz.chapterId);

  return (
    <>
      <PendingRefresh active={quiz.status === "generating"} intervalMs={3000} />
      <Link href={back} className="text-sm text-primary dark:text-lavande">
        ← {t.quiz.backToChapter}
      </Link>
      {quiz.status === "generating" ? (
        <>
          <h1 className="text-2xl font-bold">{t.quiz.title}</h1>
          <p role="status" className="rounded-xl bg-primary-soft p-4 text-sm text-nuit dark:bg-primary-strong/25 dark:text-lavande">
            {t.quiz.preparing}
          </p>
        </>
      ) : quiz.status === "failed" ? (
        <>
          <h1 className="text-2xl font-bold">{t.quiz.title}</h1>
          <p className="text-sm text-neutral-600 dark:text-neutral-300">{quiz.errorMessage ?? t.quiz.failed}</p>
          <p className="text-sm text-neutral-600 dark:text-neutral-300">{t.quiz.failed}</p>
        </>
      ) : quiz.correction ? (
        <Correction quiz={quiz} back={back} />
      ) : (
        <>
          <h1 className="text-2xl font-bold">{t.quiz.title}</h1>
          <QuizForm quizId={quiz.id} questions={quiz.questions} />
        </>
      )}
    </>
  );
}

async function Correction({ quiz, back }: { quiz: QuizView; back: string }) {
  const t = await getT();
  const correction = quiz.correction!;
  return (
    <>
      <h1 className="text-2xl font-bold">{t.quiz.correctionTitle}</h1>
      <ScoreGauge correct={correction.correct} total={correction.total} />
      <ol className="flex flex-col gap-3">
        {quiz.questions.map((q, index) => {
          const a = correction.answers[q.id];
          if (!a) return null;
          return (
            <li
              key={q.id}
              className={`flex flex-col gap-1.5 rounded-xl border p-4 text-sm leading-relaxed ${
                a.isCorrect
                  ? "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950"
                  : "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950"
              }`}
            >
              <strong className={a.isCorrect ? "text-green-800 dark:text-green-200" : "text-red-800 dark:text-red-200"}>
                {a.isCorrect ? "✓" : "✗"} {t.quiz.question} {index + 1} · {a.isCorrect ? t.quiz.right : t.quiz.wrong}
              </strong>
              <span>{q.prompt}</span>
              {!a.isCorrect ? (
                <span className="text-neutral-700 dark:text-neutral-300">
                  {t.quiz.yourAnswer} : {a.response === null ? t.quiz.noAnswer : q.choices[a.response]} · {t.quiz.expected} :{" "}
                  {q.choices[a.expected]}
                </span>
              ) : (
                <span className="text-neutral-700 dark:text-neutral-300">{q.choices[a.expected]}</span>
              )}
              {a.explanation ? <span className="text-neutral-700 dark:text-neutral-300">{a.explanation}</span> : null}
              {!a.isCorrect ? <ContestForm answerId={a.answerId} alreadyContested={a.contested} /> : null}
            </li>
          );
        })}
      </ol>
      <div className="flex flex-col gap-2">
        <StudyActionButton action={startQuizAction} moduleId={quiz.moduleId} chapterId={quiz.chapterId} label={t.quiz.newQuiz} />
        <Link href={back} className="rounded-xl border border-neutral-300 px-4 py-3 text-center font-medium dark:border-neutral-700">
          {t.quiz.later}
        </Link>
      </div>
    </>
  );
}
