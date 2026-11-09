"use client";

import { useFormStatus } from "react-dom";

import { useT } from "@/i18n/client";
import { signOutAction } from "@/server/auth/actions";

function Button() {
  const t = useT();
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
