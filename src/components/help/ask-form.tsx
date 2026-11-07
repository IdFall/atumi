"use client";

import { useActionState } from "react";

import { getMessages } from "@/i18n/messages";
import { askHelpAction, type HelpFormState } from "@/server/help/actions";

const t = getMessages("fr");

export function HelpAskForm() {
  const [state, formAction, pending] = useActionState<HelpFormState, FormData>(askHelpAction, {});
  return (
    <form action={formAction} className="flex flex-col gap-2">
      {pending ? (
        <p role="status" className="text-sm text-primary-strong dark:text-lavande">
          {t.help.thinking}
        </p>
      ) : null}
      <div className="flex gap-2">
        <input
          type="text"
          name="question"
          required
          maxLength={1000}
          disabled={pending}
          placeholder={t.help.placeholder}
          aria-label={t.help.placeholder}
          className="min-w-0 flex-1 rounded-xl border border-neutral-300 bg-white px-3 py-3 text-base outline-none focus:ring-2 focus:ring-primary dark:border-neutral-700 dark:bg-neutral-900"
        />
        <button
          type="submit"
          disabled={pending}
          aria-label={t.help.send}
          className="flex w-12 items-center justify-center rounded-xl bg-primary text-white disabled:opacity-60"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
      </div>
      <p className="text-xs text-neutral-500">{t.help.notCounted}</p>
      {state.error ? (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {t.help.errors[state.error]}
        </p>
      ) : null}
    </form>
  );
}
