"use client";

import { useActionState } from "react";

import { useT } from "@/i18n/client";
import { exploreFurtherAction, type FurtherFormState } from "@/server/tutor/actions";

/** « Pour aller plus loin » : suite de l'explication avec d'autres sources du web. */
export function FurtherButton({ conversationId }: { conversationId: string }) {
  const t = useT().tutor.further;
  const [state, formAction, pending] = useActionState<FurtherFormState, FormData>(exploreFurtherAction, {});
  return (
    <form action={formAction} className="flex flex-col gap-1.5 rounded-2xl border border-dashed border-primary/40 bg-primary-soft/40 p-3 dark:bg-primary-strong/10">
      <input type="hidden" name="conversationId" value={conversationId} />
      <button
        type="submit"
        disabled={pending}
        className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-electrique px-4 py-2.5 font-semibold text-white shadow-md shadow-primary/30 disabled:opacity-70"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3.6 9h16.8M3.6 15h16.8M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
        </svg>
        {pending ? t.pending : t.cta}
      </button>
      <p className="text-center text-xs text-neutral-600 dark:text-neutral-300">{t.hint}</p>
      {state.error ? (
        <p role="alert" className="text-center text-sm text-red-700 dark:text-red-400">
          {t.errors[state.error]}
        </p>
      ) : null}
    </form>
  );
}
