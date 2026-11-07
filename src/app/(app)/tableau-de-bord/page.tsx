import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AccessBanner } from "@/components/courses/access-banner";
import { ModuleCard } from "@/components/courses/module-card";
import { getMessages } from "@/i18n/messages";
import { signOutAction } from "@/server/auth/actions";
import { getCurrentUser } from "@/server/auth/session";
import { getAccess, listModules } from "@/server/courses/queries";

const t = getMessages("fr");

export const metadata: Metadata = { title: t.app.name };

export default function DashboardPage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-8">
      <Suspense fallback={<p>{t.dashboard.loading}</p>}>
        <Dashboard />
      </Suspense>
      <Link href="/aide" className="text-sm font-medium text-primary dark:text-lavande">
        {t.help.link}
      </Link>
      <form action={signOutAction}>
        <button type="submit" className="text-sm text-neutral-600 underline dark:text-neutral-300">
          {t.auth.signOut}
        </button>
      </form>
    </main>
  );
}

async function Dashboard() {
  const [user, access, modules] = await Promise.all([getCurrentUser(), getAccess(), listModules()]);
  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">
          {t.dashboard.greeting}, {user.username}
        </h1>
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
