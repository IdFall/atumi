"use client";

import { useActionState } from "react";

import { getMessages } from "@/i18n/messages";
import { sendTutorMessageAction, type TutorFormState } from "@/server/tutor/actions";

const t = getMessages("fr");

/** Lance le mode « approfondir » : explication complète du chapitre, étape par étape. */
export function DeepenButton({ moduleId, chapterId }: { moduleId: string; chapterId: string }) {
  const [state, formAction, pending] = useActionState<TutorFormState, FormData>(sendTutorMessageAction, {});
  return (
    <form action={formAction} className="flex flex-col gap-1">
      <input type="hidden" name="conversationId" value="" />
      <input type="hidden" name="mode" value="approfondir" />
      <input type="hidden" name="moduleId" value={moduleId} />
      <input type="hidden" name="chapterId" value={chapterId} />
      <input type="hidden" name="text" value={t.tutor.deepenQuestion} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl border border-amber-700 bg-white px-4 py-2.5 font-semibold text-amber-800 disabled:opacity-60 dark:bg-neutral-900 dark:text-amber-300"
      >
        {pending ? t.tutor.thinking : t.tutor.deepenCta}
      </button>
      {state.error ? (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {t.tutor.errors[state.error]}
        </p>
      ) : null}
    </form>
  );
}
