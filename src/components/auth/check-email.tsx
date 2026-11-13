"use client";

import Link from "next/link";
import { useActionState } from "react";

import { FormMessage } from "@/components/ui/form";
import { fill } from "@/i18n/format";
import { useT } from "@/i18n/client";
import { resendConfirmationAction, type FormState } from "@/server/auth/actions";

/**
 * Après une inscription par e-mail : le compte reste inactif tant que le lien
 * reçu n'est pas ouvert. On le dit clairement, avec l'adresse, les étapes et
 * un bouton pour renvoyer le lien.
 */
export function CheckEmailPanel({ email }: { email: string }) {
  const t = useT();
  const c = t.auth.confirmEmail;
  const [state, resendAction, pending] = useActionState<FormState, FormData>(resendConfirmationAction, {});

  return (
    <section
      role="status"
      className="flex flex-col gap-4 rounded-2xl border border-primary/30 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900"
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-white"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 6h16v12H4z" />
            <path d="m4 7 8 6 8-6" />
          </svg>
        </span>
        <h2 className="text-lg font-bold">{c.title}</h2>
      </div>
      <p className="text-sm">
        {email ? fill(c.sentTo, { email }) : c.sentToUnknown}
      </p>
      <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm">
        <li>{c.step1}</li>
        <li>{c.step2}</li>
        <li>{c.step3}</li>
      </ol>
      <p className="rounded-lg bg-accent/10 p-3 text-sm">{c.spam}</p>

      {state.notice === "confirmationResent" ? (
        <FormMessage tone="info">{t.auth.confirmationResent}</FormMessage>
      ) : email ? (
        <form action={resendAction}>
          <input type="hidden" name="identifier" value={email} />
          <button
            type="submit"
            disabled={pending}
            className="text-sm font-semibold text-primary underline disabled:opacity-60 dark:text-lavande"
          >
            {t.auth.resendConfirmation}
          </button>
        </form>
      ) : null}

      <Link href="/connexion" className="rounded-lg bg-primary px-4 py-3 text-center font-semibold text-white">
        {c.toSignIn}
      </Link>
    </section>
  );
}
