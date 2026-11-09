import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { AccessBanner } from "@/components/courses/access-banner";
import { ModuleCard } from "@/components/courses/module-card";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { getT } from "@/i18n/server";
import { getCurrentUser } from "@/server/auth/session";
import { getAccess, listModules } from "@/server/courses/queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t.app.name };
}

export default async function DashboardPage() {
  const t = await getT();
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-8">
      <Suspense fallback={<p>{t.dashboard.loading}</p>}>
        <Dashboard />
      </Suspense>
      <Link href="/aide" className="text-sm font-medium text-primary dark:text-lavande">
        {t.help.link}
      </Link>
      <Link href="/a-propos" className="text-sm font-medium text-primary dark:text-lavande">
        {t.home.aboutLink}
      </Link>
      <div className="self-start">
        <SignOutButton />
      </div>
    </main>
  );
}

async function Dashboard() {
  const t = await getT();
  const [user, access, modules] = await Promise.all([getCurrentUser(), getAccess(), listModules()]);
  return (
    <>
      <header className="flex flex-col gap-1">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-bold">
            {t.dashboard.greeting}, {user.username}
          </h1>
          <LocaleSwitcher className="shrink-0 pt-1" />
        </div>
        <p className="text-sm text-neutral-600 dark:text-neutral-300">{t.auth.cycles[user.cycle]}</p>
      </header>

      <AccessBanner access={access} />

      <Link href="/importer" className="rounded-xl bg-primary px-4 py-3 text-center font-semibold text-white">
        {t.dashboard.importCta}
      </Link>

      {modules.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-300 p-6 text-center text-neutral-600 dark:border-neutral-700 dark:text-neutral-300">
          {t.dashboard.empty}
        </p>
      ) : (
        <section className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold">{t.dashboard.recentModules}</h2>
            <Link href="/cours" className="text-sm font-medium text-primary dark:text-lavande">
              {t.dashboard.seeAll}
            </Link>
          </div>
          <ul className="flex flex-col gap-3">
            {modules.slice(0, 3).map((m) => (
              <li key={m.id}>
                <ModuleCard module={m} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
