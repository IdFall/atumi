"use client";

import { useActionState } from "react";

import { useT } from "@/i18n/client";
import { submitQuizAction, type SubmitState } from "@/server/study/actions";
import type { QuizQuestionView } from "@/server/study/queries";

export function QuizForm({ quizId, questions }: { quizId: string; questions: QuizQuestionView[] }) {
  const t = useT();
  const [state, formAction, pending] = useActionState<SubmitState, FormData>(submitQuizAction, {});
  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="quizId" value={quizId} />
      {questions.map((q, index) => (
        <fieldset key={q.id} className="flex flex-col gap-2 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <legend className="sr-only">
            {t.quiz.question} {index + 1}
          </legend>
          <p className="text-sm font-semibold text-primary-strong dark:text-lavande">
            {t.quiz.question} {index + 1} / {questions.length}
          </p>
          <p className="font-medium">{q.prompt}</p>
          <div className="flex flex-col gap-2">
            {q.choices.map((choice, i) => (
              <label
                key={i}
                className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-neutral-300 px-3 py-2 has-[:checked]:border-2 has-[:checked]:border-primary has-[:checked]:bg-primary-soft dark:border-neutral-700 dark:has-[:checked]:bg-primary-strong/25"
              >
                <input type="radio" name={`q-${q.id}`} value={i} required className="size-4 accent-primary" />
                <span>{choice}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      {state.error ? (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
          {state.error === "unanswered" ? t.quiz.unanswered : t.study.errors.unknown}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className="rounded-xl bg-primary px-4 py-3 font-semibold text-white disabled:opacity-60">
        {t.quiz.submit}
      </button>
    </form>
  );
}
