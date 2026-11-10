"use client";

import { useFormStatus } from "react-dom";

import { useT } from "@/i18n/client";
import { signOutAction } from "@/server/auth/actions";

const STYLES = {
  light:
    "rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-60 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800",
  dark: "w-full rounded-lg border border-white/30 px-3 py-2 text-left text-sm font-medium text-white/90 hover:bg-white/10 disabled:opacity-60",
} as const;

function Button({ tone }: { tone: keyof typeof STYLES | "icon" }) {
  const t = useT();
  const { pending } = useFormStatus();
  if (tone === "icon") {
    // En-tête téléphone : simple icône, le libellé reste lu par les lecteurs d'écran.
    return (
      <button
        type="submit"
        disabled={pending}
        aria-label={pending ? t.auth.signingOut : t.auth.signOut}
        title={t.auth.signOut}
        className="flex size-9 items-center justify-center rounded-full text-neutral-600 hover:bg-neutral-100 disabled:opacity-60 dark:text-neutral-300 dark:hover:bg-neutral-800"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H4" />
        </svg>
      </button>
    );
  }
  return (
    <button type="submit" disabled={pending} className={STYLES[tone]}>
      {pending ? t.auth.signingOut : t.auth.signOut}
    </button>
  );
}

/** Bouton de déconnexion : montre tout de suite que le clic est pris en compte. */
export function SignOutButton({ tone = "light" }: { tone?: keyof typeof STYLES | "icon" }) {
  return (
    <form action={signOutAction}>
      <Button tone={tone} />
    </form>
  );
}
