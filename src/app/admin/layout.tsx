import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";

import { AdminNav, AdminNavList } from "@/components/admin/admin-nav";
import { getT } from "@/i18n/server";
import { requireAdmin } from "@/server/admin/queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: `${t.admin.title} · ${t.app.name}`, robots: { index: false, follow: false } };
}

/**
 * Espace administrateur : menu sombre à gauche (en haut sur téléphone).
 * Le contenu n'est rendu qu'après la vérification du rôle en base ;
 * chaque lecture est de toute façon refusée par la base à un non-administrateur.
 */
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const t = await getT();
  return (
    <div className="flex min-h-full flex-1 flex-col lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="flex flex-col gap-3 bg-nuit px-4 py-4 text-white lg:sticky lg:top-0 lg:h-screen lg:gap-6 lg:py-7">
        <div className="px-3">
          <p className="text-base font-bold tracking-widest">{t.app.name}</p>
          <p className="text-xs text-neutral-300">{t.admin.title}</p>
        </div>
        <Suspense fallback={<AdminNavList pathname={null} />}>
          <AdminNav />
        </Suspense>
        <div className="mt-auto hidden flex-col gap-3 lg:flex">
          <p className="rounded-lg bg-white/5 p-3 text-xs leading-relaxed text-neutral-300">{t.admin.privacy}</p>
          <Link href="/tableau-de-bord" className="px-3 text-sm text-lavande hover:text-white">
            {t.admin.backToApp}
          </Link>
        </div>
      </aside>
      <div className="min-w-0 px-4 py-6 lg:px-8 lg:py-8">
        <Suspense fallback={null}>
          <AdminGate>{children}</AdminGate>
        </Suspense>
      </div>
    </div>
  );
}

async function AdminGate({ children }: { children: ReactNode }) {
  await requireAdmin();
  return <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">{children}</div>;
}
