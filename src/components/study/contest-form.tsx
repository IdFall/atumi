"use client";

import { useActionState, useState } from "react";

import { useT } from "@/i18n/client";
import { contestAnswerAction, type ContestState } from "@/server/study/actions";

/** Contestation : la réponse est toujours la même, sans débat (décision V1). */
export function ContestForm({ answerId, alreadyContested }: { answerId: string; alreadyContested: boolean }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ContestState, FormData>(contestAnswerAction, {});

  if (state.reply) {
    return (
      <p role="status" className="rounded-lg bg-neutral-100 p-3 text-sm leading-relaxed dark:bg-neutral-800">
        {state.reply}
      </p>
    );
  }
  if (alreadyContested) return <p className="text-xs text-neutral-500">{t.quiz.contested}</p>;
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="self-start rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
      >
        {t.quiz.contest}
      </button>
    );
  }
  return (
    <form action={formAction} className="flex flex-col gap-2 text-sm">
      <input type="hidden" name="answerId" value={answerId} />
      <label className="flex flex-col gap-1">
        <span>{t.quiz.contestReason}</span>
        <textarea
          name="reason"
          maxLength={1000}
          rows={2}
          className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-base dark:border-neutral-700 dark:bg-neutral-900"
        />
      </label>
      <button type="submit" disabled={pending} className="self-start rounded-lg bg-primary px-3 py-1.5 font-semibold text-white disabled:opacity-60">
        {t.quiz.contestSend}
      </button>
      {state.error ? <span role="alert" className="text-red-700">{t.study.errors.unknown}</span> : null}
    </form>
  );
}
