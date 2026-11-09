import Link from "next/link";

import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { getT } from "@/i18n/server";

export default async function Home() {
  const t = await getT();
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-8 px-4 py-10">
      <header className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold tracking-wide text-primary dark:text-lavande">{t.app.name}</p>
          <LocaleSwitcher />
        </div>
        <h1 className="text-3xl font-bold leading-tight">{t.home.title}</h1>
        <p className="text-base text-neutral-600 dark:text-neutral-300">{t.home.intro}</p>
      </header>

      <ol className="flex flex-col gap-3">
        {t.home.steps.map((step, index) => (
          <li
            key={step.title}
            className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800"
          >
            <p className="font-semibold">
              {index + 1}. {step.title}
            </p>
            <p className="text-sm text-neutral-600 dark:text-neutral-300">{step.body}</p>
          </li>
        ))}
      </ol>

      <div className="flex flex-col gap-2">
        <Link
          href="/inscription"
          className="rounded-lg bg-primary px-4 py-3 text-center font-semibold text-white"
        >
          {t.home.signUp}
        </Link>
        <p className="text-center text-sm text-neutral-500">{t.home.trial}</p>
        <p className="mt-2 text-center text-sm text-neutral-600 dark:text-neutral-300">{t.home.signInHint}</p>
        <Link
          href="/connexion"
          className="rounded-lg border-2 border-primary px-4 py-3 text-center font-semibold text-primary dark:border-lavande dark:text-lavande"
        >
          {t.home.signIn}
        </Link>
      </div>
    </main>
  );
}
