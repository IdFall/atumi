"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { useT } from "@/i18n/client";

type NavKey = "home" | "courses" | "import" | "tutor" | "agenda" | "help";

const ITEMS = [
  { href: "/tableau-de-bord", label: "home", icon: "M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" },
  { href: "/cours", label: "courses", icon: "M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2zM4 19V5M8 7h6" },
  { href: "/importer", label: "import", icon: "M12 16V4M7 9l5-5 5 5M4 20h16" },
  { href: "/professeur", label: "tutor", icon: "M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" },
  { href: "/agenda", label: "agenda", icon: "M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM4 10h16M8 2v4M16 2v4M8 14h2M14 14h2M8 17h2" },
  { href: "/aide", label: "help", icon: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17.5v.01" },
] as const satisfies readonly { href: string; label: NavKey; icon: string }[];

function isActive(pathname: string | null, href: string) {
  return pathname !== null && (pathname === href || pathname.startsWith(`${href}/`));
}

function Icon({ d }: { d: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

/** Menu permanent de l'espace connecté, avec l'élément actif. */
export function BottomNav() {
  return <NavBar pathname={usePathname()} />;
}

/**
 * Téléphone : en-tête (ATUMI, FR/EN) et barre fixe en bas, pensée pour le pouce.
 * Ordinateur : menu latéral sombre, toujours visible.
 * Sans chemin (prérendu), aucun élément n'est marqué actif.
 */
export function NavBar({ pathname }: { pathname: string | null }) {
  const t = useT();
  return (
    <>
      <header className="flex items-center justify-between border-b border-neutral-200 px-4 py-2 md:hidden dark:border-neutral-800">
        <Link href="/tableau-de-bord" className="text-sm font-bold tracking-wide text-primary dark:text-lavande">
          {t.app.name}
        </Link>
        <LocaleSwitcher />
      </header>

      <nav
        aria-label={t.nav.label}
        className="fixed inset-x-0 bottom-0 z-10 border-t border-neutral-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden dark:border-neutral-800 dark:bg-neutral-950"
      >
        <ul className="mx-auto grid max-w-xl grid-cols-6">
          {ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-14 flex-col items-center justify-center gap-1 text-[10px] font-medium ${
                    active ? "text-primary" : "text-neutral-600 dark:text-neutral-400"
                  }`}
                >
                  <Icon d={item.icon} />
                  {t.nav[item.label]}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <nav
        aria-label={t.nav.label}
        className="fixed inset-y-0 left-0 z-10 hidden w-60 flex-col gap-6 bg-nuit px-4 py-6 text-white md:flex"
      >
        <Link href="/tableau-de-bord" className="px-3 text-lg font-bold tracking-wide text-lavande">
          {t.app.name}
        </Link>
        <ul className="flex flex-col gap-1">
          {ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${
                    active ? "bg-primary text-white" : "text-white/80 hover:bg-white/10"
                  }`}
                >
                  <Icon d={item.icon} />
                  {t.nav[item.label]}
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="mt-auto flex flex-col gap-2 px-3">
          <span className="text-xs text-white/60">{t.locale.label}</span>
          <LocaleSwitcher tone="dark" />
          <div className="mt-3">
            <SignOutButton tone="dark" />
          </div>
        </div>
      </nav>
    </>
  );
}
