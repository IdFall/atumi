"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { getMessages } from "@/i18n/messages";

const t = getMessages("fr");

const ITEMS = [
  { href: "/tableau-de-bord", label: t.nav.home, icon: "M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" },
  { href: "/cours", label: t.nav.courses, icon: "M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2zM4 19V5M8 7h6" },
  { href: "/importer", label: t.nav.import, icon: "M12 16V4M7 9l5-5 5 5M4 20h16" },
] as const;

/** Barre de navigation fixe en bas de l'écran, pensée pour le pouce sur téléphone. */
export function BottomNav() {
  return <NavBar pathname={usePathname()} />;
}

/** Même barre sans élément actif, affichée pendant le prérendu (le chemin n'est connu qu'au navigateur). */
export function NavBar({ pathname }: { pathname: string | null }) {
  return (
    <nav
      aria-label={t.nav.label}
      className="fixed inset-x-0 bottom-0 z-10 border-t border-neutral-200 bg-white pb-[env(safe-area-inset-bottom)] dark:border-neutral-800 dark:bg-neutral-950"
    >
      <ul className="mx-auto grid max-w-xl grid-cols-3">
        {ITEMS.map((item) => {
          const active = pathname !== null && (pathname === item.href || pathname.startsWith(`${item.href}/`));
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-1 text-xs font-medium ${
                  active ? "text-amber-700" : "text-neutral-600 dark:text-neutral-400"
                }`}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d={item.icon} />
                </svg>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
