import type { Metadata } from "next";
import { Suspense } from "react";

import { getMessages } from "@/i18n/messages";
import { signOutAction } from "@/server/auth/actions";
import { getCurrentUser } from "@/server/auth/session";

const t = getMessages("fr");

export const metadata: Metadata = { title: t.app.name };

export default function DashboardPage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-10">
      <Suspense fallback={<p>{t.dashboard.loading}</p>}>
        <Greeting />
      </Suspense>
      <p className="rounded-lg border border-dashed border-neutral-300 p-6 text-center text-neutral-600 dark:border-neutral-700 dark:text-neutral-300">
        {t.dashboard.empty}
      </p>
      <form action={signOutAction}>
        <button type="submit" className="text-sm text-neutral-600 underline dark:text-neutral-300">
          {t.auth.signOut}
        </button>
      </form>
    </main>
  );
}

async function Greeting() {
  const user = await getCurrentUser();
  return (
    <header className="flex flex-col gap-1">
      <h1 className="text-2xl font-bold">
        {t.dashboard.greeting}, {user.username}
      </h1>
      <p className="text-sm text-neutral-600 dark:text-neutral-300">{t.auth.cycles[user.cycle]}</p>
    </header>
  );
}
