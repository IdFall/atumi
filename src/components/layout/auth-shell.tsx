import Link from "next/link";
import type { ReactNode } from "react";

import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { getT } from "@/i18n/server";

/** Cadre des pages de compte : logo, langue, lien « Retour » vers l'accueil public. */
export async function AuthShell({ title, children }: { title: string; children: ReactNode }) {
  const t = await getT();
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-10">
      <div className="flex items-center justify-between gap-3">
        <Link href="/" className="text-sm font-semibold tracking-wide text-primary dark:text-lavande">
          {t.app.name}
        </Link>
        <LocaleSwitcher />
      </div>
      <Link
        href="/"
        className="-mb-3 inline-flex w-fit items-center gap-1 text-sm font-medium text-neutral-600 underline-offset-4 hover:text-primary hover:underline dark:text-neutral-300 dark:hover:text-lavande"
      >
        <span aria-hidden="true">←</span>
        {t.auth.backHome}
      </Link>
      <h1 className="text-2xl font-bold">{title}</h1>
      {children}
    </main>
  );
}
