import Image from "next/image";
import Link from "next/link";

import { getT } from "@/i18n/server";

/**
 * Présentation du Prof NEO sur l'accueil : dit dès la connexion à quoi sert
 * ATUMI. Ouverte tant que l'élève n'a aucun cours, repliée ensuite (un clic la
 * rouvre), sans rien enregistrer.
 */
export async function NeoIntro({ open }: { open: boolean }) {
  const t = await getT();
  const n = t.dashboard.neo;
  return (
    <details open={open} className="group rounded-2xl border border-primary/20 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
      <summary className="flex cursor-pointer list-none items-center gap-3 p-4 [&::-webkit-details-marker]:hidden">
        <Image src="/prof-atumi.svg" alt={t.tutor.avatarAlt} width={48} height={48} className="shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-accent-text dark:text-accent">{n.kicker}</p>
          <h2 className="text-lg font-bold">{n.title}</h2>
        </div>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 text-primary transition-transform group-open:rotate-180 dark:text-lavande">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </summary>
      <div className="flex flex-col gap-3 px-4 pb-4">
        <p className="text-sm text-neutral-700 dark:text-neutral-200">{n.intro}</p>
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">{n.modesTitle}</h3>
          <ul className="grid gap-2 sm:grid-cols-3">
            {t.about.profModes.map((mode) => (
              <li key={mode.title} className="rounded-xl bg-primary-soft p-3 text-sm dark:bg-neutral-900">
                <strong className="block text-primary-strong dark:text-lavande">{mode.title}</strong>
                {mode.body}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-sm font-semibold">{t.about.profRule}</p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link href="/professeur" className="rounded-xl bg-gradient-to-r from-primary to-electrique px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-primary/30">
            {n.cta}
          </Link>
          <Link href="/a-propos#prof" className="text-sm font-medium text-primary dark:text-lavande">
            {n.more}
          </Link>
        </div>
      </div>
    </details>
  );
}
