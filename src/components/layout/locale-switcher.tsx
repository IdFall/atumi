"use client";

import { LOCALES } from "@/config/countries";
import { useLocale, useT } from "@/i18n/client";
import { setLocaleAction } from "@/server/i18n/actions";

/** Choix de la langue de l'interface : FR / EN. */
export function LocaleSwitcher({ className = "" }: { className?: string }) {
  const t = useT();
  const current = useLocale();
  return (
    <form action={setLocaleAction} role="radiogroup" aria-label={t.locale.label} className={`flex gap-1 text-xs ${className}`}>
      {LOCALES.map((locale) => (
        <button
          key={locale}
          type="submit"
          name="locale"
          value={locale}
          role="radio"
          aria-checked={locale === current}
          title={t.locale.titles[locale]}
          lang={locale}
          className={`rounded-full px-2.5 py-1 font-semibold ${
            locale === current ? "bg-primary text-white" : "border border-neutral-300 text-neutral-600 dark:border-neutral-700 dark:text-neutral-300"
          }`}
        >
          {t.locale.names[locale]}
        </button>
      ))}
    </form>
  );
}
