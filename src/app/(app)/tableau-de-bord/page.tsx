import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { DashboardView } from "@/components/dashboard/dashboard-view";
import { getT } from "@/i18n/server";
import { nextMission } from "@/lib/mission";
import { listReminders, todayFor } from "@/server/agenda/queries";
import { getCurrentUser } from "@/server/auth/session";
import { getAccess, listModules } from "@/server/courses/queries";
import { getDashboardStats } from "@/server/dashboard/queries";
import { getAvatarUrl } from "@/server/profile/avatar";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t.app.name };
}

export default async function DashboardPage() {
  const t = await getT();
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6 md:py-8">
      <Suspense fallback={<p>{t.dashboard.loading}</p>}>
        <Dashboard />
      </Suspense>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        <Link href="/aide" className="font-medium text-primary dark:text-lavande">
          {t.help.link}
        </Link>
        <Link href="/a-propos" className="font-medium text-primary dark:text-lavande">
          {t.home.aboutLink}
        </Link>
      </div>
    </main>
  );
}

async function Dashboard() {
  const user = await getCurrentUser();
  const today = todayFor(user.countryCode);
  const [access, modules, reminders, stats, avatarUrl] = await Promise.all([
    getAccess(),
    listModules(),
    listReminders(today),
    getDashboardStats(),
    getAvatarUrl(user.id),
  ]);
  return (
    <DashboardView
      userId={user.id}
      username={user.username}
      avatarUrl={avatarUrl}
      cycle={user.cycle}
      access={access}
      mission={nextMission(modules, reminders)}
      reminders={reminders}
      today={today}
      stats={stats}
      moduleCount={modules.length}
    />
  );
}
