"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useT } from "@/i18n/client";
import type { Messages } from "@/i18n/messages";

type NavKey = Exclude<keyof Messages["admin"]["nav"], "label">;

const ITEMS: readonly { href: string; key: NavKey }[] = [
  { href: "/admin", key: "overview" },
  { href: "/admin/utilisateurs", key: "users" },
  { href: "/admin/nouveau-compte", key: "create" },
  { href: "/admin/forfaits", key: "plans" },
  { href: "/admin/messages", key: "messages" },
  { href: "/admin/ia", key: "ai" },
  { href: "/admin/journal", key: "journal" },
];

/** Menu de l'administration : colonne sombre sur ordinateur, bandeau défilant sur téléphone. */
export function AdminNav() {
  return <AdminNavList pathname={usePathname()} />;
}

export function AdminNavList({ pathname }: { pathname: string | null }) {
  const t = useT();
  return (
    <nav aria-label={t.admin.nav.label}>
      <ul className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
        {ITEMS.map((item) => {
          const active =
            pathname !== null &&
            (item.href === "/admin" ? pathname === "/admin" : pathname === item.href || pathname.startsWith(`${item.href}/`));
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`block whitespace-nowrap rounded-lg px-3 py-2.5 text-sm ${
                  active ? "bg-white/10 font-semibold text-white" : "text-neutral-300 hover:bg-white/5 hover:text-white"
                }`}
              >
                {t.admin.nav[item.key]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
