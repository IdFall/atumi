"use client";

import { useFormStatus } from "react-dom";

import { getMessages } from "@/i18n/messages";
import { signOutAction } from "@/server/auth/actions";

const t = getMessages("fr");

function Button() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-60 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
    >
      {pending ? t.auth.signingOut : t.auth.signOut}
    </button>
  );
}

/** Bouton de déconnexion : montre tout de suite que le clic est pris en compte. */
export function SignOutButton() {
  return (
    <form action={signOutAction}>
      <Button />
    </form>
  );
}
