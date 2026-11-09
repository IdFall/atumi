"use client";

import { useActionState } from "react";

import { useT } from "@/i18n/client";
import type { StudyFormState } from "@/server/study/actions";

/** Bouton qui lance une préparation (synthèse ou quiz) et affiche l'erreur éventuelle. */
export function StudyActionButton({
  action,
  moduleId,
  chapterId,
  label,
  variant = "primary",
}: {
  action: (prev: StudyFormState, formData: FormData) => Promise<StudyFormState>;
  moduleId: string;
  chapterId: string | null;
  label: string;
  variant?: "primary" | "secondary";
}) {
  const t = useT();
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="moduleId" value={moduleId} />
      <input type="hidden" name="chapterId" value={chapterId ?? ""} />
      <button
        type="submit"
        disabled={pending}
        className={
          variant === "primary"
            ? "rounded-xl bg-primary px-4 py-3 font-semibold text-white disabled:opacity-60"
            : "rounded-xl border border-primary bg-white px-4 py-3 font-semibold text-primary-strong disabled:opacity-60 dark:bg-neutral-900 dark:text-lavande"
        }
      >
        {label}
      </button>
      {state.error ? (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {t.study.errors[state.error]}
        </p>
      ) : null}
    </form>
  );
}
