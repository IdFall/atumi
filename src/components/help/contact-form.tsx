"use client";

import { useActionState } from "react";

import { useT } from "@/i18n/client";
import { contactTeamAction, type HelpFormState } from "@/server/help/actions";

export function ContactTeamForm() {
  const t = useT();
  const [state, formAction, pending] = useActionState<HelpFormState, FormData>(contactTeamAction, {});
  if (state.sent) {
    return (
      <p role="status" className="rounded-xl bg-green-50 p-4 text-sm text-green-800 dark:bg-green-950 dark:text-green-100">
        {t.help.contactSent}
      </p>
    );
  }
  return (
    <details className="rounded-xl border border-dashed border-lavande bg-white p-4 dark:bg-nuit">
      <summary className="flex cursor-pointer items-center justify-between gap-3 text-sm">
        <span>{t.help.contactTitle}</span>
        <span className="font-semibold text-accent-text dark:text-accent">{t.help.contactCta}</span>
      </summary>
      <form action={formAction} className="mt-3 flex flex-col gap-2">
        <textarea
          name="message"
          required
          rows={4}
          maxLength={2000}
          disabled={pending}
          placeholder={t.help.contactPlaceholder}
          aria-label={t.help.contactCta}
          className="resize-none rounded-xl border border-neutral-300 bg-white px-3 py-2 text-base outline-none focus:ring-2 focus:ring-primary dark:border-neutral-700 dark:bg-neutral-900"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-primary px-4 py-3 font-semibold text-white disabled:opacity-60"
        >
          {t.help.contactSend}
        </button>
        {state.error ? (
          <p role="alert" className="text-sm text-red-700 dark:text-red-400">
            {t.help.errors[state.error]}
          </p>
        ) : null}
      </form>
    </details>
  );
}
