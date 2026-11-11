import Link from "next/link";

import { BackLink } from "@/components/about/back-link";
import { Hero } from "@/components/layout/hero";
import type { Messages } from "@/i18n/messages";

type LegalText = Messages["legal"]["terms"];

/** Mise en page commune des pages légales publiques (conditions, confidentialité). */
export function LegalPage({ text, legal, appName }: { text: LegalText; legal: Messages["legal"]; appName: string }) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      <BackLink label={legal.back} />

      <Hero>
        <p className="text-sm font-semibold tracking-wide text-lavande">{appName}</p>
        <h1 className="text-3xl font-bold leading-tight">{text.title}</h1>
        <p className="text-sm text-white/80">{legal.updated}</p>
      </Hero>

      <p className="text-neutral-700 dark:text-neutral-200">{text.intro}</p>

      {text.sections.map((section) => (
        <section key={section.title} className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">{section.title}</h2>
          {section.body.map((paragraph) => (
            <p key={paragraph} className="text-sm leading-relaxed text-neutral-700 dark:text-neutral-200">
              {paragraph}
            </p>
          ))}
        </section>
      ))}

      <section className="flex flex-col gap-2 rounded-xl bg-primary-soft p-4 text-primary-strong dark:bg-primary-strong/25 dark:text-lavande">
        <h2 className="font-semibold">{legal.contactTitle}</h2>
        <p className="text-sm">{legal.contactBody}</p>
      </section>

      <LegalLinks legal={legal} />
    </main>
  );
}

/** Liens vers les deux pages légales (pied des pages publiques). */
export function LegalLinks({ legal, className = "" }: { legal: Messages["legal"]; className?: string }) {
  return (
    <nav className={`flex flex-wrap gap-x-4 gap-y-1 text-sm text-neutral-500 ${className}`}>
      <Link href="/conditions" className="underline-offset-4 hover:underline">
        {legal.termsLink}
      </Link>
      <Link href="/confidentialite" className="underline-offset-4 hover:underline">
        {legal.privacyLink}
      </Link>
    </nav>
  );
}
