"use client";

import { useActionState } from "react";

import { useT } from "@/i18n/client";
import { askResearchAction, type ResearchFormState } from "@/server/research/actions";

/** Question libre pour la recherche sur le web ; la réponse apparaît dans l'historique. */
export function ResearchForm({ disabled }: { disabled: boolean }) {
  const r = useT().research;
  const [state, action, pending] = useActionState<ResearchFormState, FormData>(askResearchAction, {});
  return (
    <form action={action} className="flex flex-col gap-2">
      <label htmlFor="research-question" className="text-sm font-medium">
        {r.label}
      </label>
      <textarea
        id="research-question"
        name="question"
        required
        minLength={3}
        maxLength={500}
        rows={3}
        disabled={pending || disabled}
        placeholder={r.placeholder}
        className="w-full resize-none rounded-xl border border-neutral-300 bg-white px-3 py-2 text-base outline-none focus:ring-2 focus:ring-primary disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-950"
      />
      <button
        type="submit"
        disabled={pending || disabled}
        className="rounded-xl bg-electrique px-4 py-3 font-semibold text-white disabled:opacity-60"
      >
        {pending ? r.pending : r.submit}
      </button>
      {state.error ? (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {r.errors[state.error]}
        </p>
      ) : null}
    </form>
  );
}
