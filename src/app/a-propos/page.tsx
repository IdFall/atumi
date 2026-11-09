import type { Metadata } from "next";
import Image from "next/image";

import { BackLink } from "@/components/about/back-link";
import { Hero } from "@/components/layout/hero";
import { getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: `${t.about.title} · ${t.app.name}` };
}

/** Présentation publique d'ATUMI et de Prof ATUMI : objectif, rôle, modes. */
export default async function AboutPage() {
  const t = await getT();
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-8">
      <BackLink label={t.about.back} />

      <Hero>
        <p className="text-sm font-semibold tracking-wide text-lavande">{t.app.name}</p>
        <h1 className="text-3xl font-bold leading-tight">{t.about.title}</h1>
        <p className="text-base text-white/85">{t.about.intro}</p>
        <p className="text-sm font-medium text-lavande">{t.about.nameMeaning}</p>
      </Hero>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{t.about.missionTitle}</h2>
        <p className="rounded-xl bg-primary-soft p-4 text-primary-strong dark:bg-primary-strong/25 dark:text-lavande">
          {t.about.mission}
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{t.about.roleTitle}</h2>
        <ul className="flex list-disc flex-col gap-1 pl-5 text-neutral-700 dark:text-neutral-200">
          {t.about.roles.map((role) => (
            <li key={role}>{role}</li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{t.about.limitsTitle}</h2>
        <ul className="flex list-disc flex-col gap-1 pl-5 text-neutral-700 dark:text-neutral-200">
          {t.about.limits.map((limit) => (
            <li key={limit}>{limit}</li>
          ))}
        </ul>
      </section>

      <section id="prof" className="flex scroll-mt-6 flex-col gap-3 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
        <div className="flex items-center gap-3">
          <Image src="/prof-atumi.svg" alt={t.tutor.avatarAlt} width={56} height={56} />
          <h2 className="text-lg font-semibold">{t.about.profTitle}</h2>
        </div>
        <p className="text-neutral-700 dark:text-neutral-200">{t.about.profIntro}</p>
        <ul className="flex flex-col gap-2">
          {t.about.profModes.map((mode) => (
            <li key={mode.title} className="text-sm">
              <strong className="text-primary-strong dark:text-lavande">{mode.title}</strong> : {mode.body}
            </li>
          ))}
        </ul>
        <p className="text-sm font-semibold">{t.about.profRule}</p>
        <p className="text-sm text-neutral-600 dark:text-neutral-300">{t.about.profLanguages}</p>
      </section>
    </main>
  );
}
