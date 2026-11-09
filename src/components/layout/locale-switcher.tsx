"use client";

import { useTransition } from "react";

import { LOCALES, type Locale } from "@/config/countries";
import { useLocale, useT } from "@/i18n/client";
import { setLocaleAction } from "@/server/i18n/actions";

/** Pose le cookie de langue dans le navigateur, sans attendre le serveur. */
function rememberLocale(locale: Locale) {
  document.cookie = `atumi_locale=${locale}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
}

/**
 * Choix de la langue de l'interface : FR / EN. Le cookie est posé tout de suite
 * dans le navigateur, le profil est mis à jour, puis la page est rechargée pour
 * que tout l'écran change de langue.
 */
export function LocaleSwitcher({ className = "", tone = "light" }: { className?: string; tone?: "light" | "dark" }) {
  const t = useT();
  const current = useLocale();
  const [pending, startTransition] = useTransition();

  const choose = (locale: Locale) => {
    if (locale === current) return;
    rememberLocale(locale);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("locale", locale);
      await setLocaleAction(formData).catch(() => undefined);
      window.location.reload();
    });
  };

  const idle = tone === "dark" ? "border border-white/30 text-white/80" : "border border-neutral-300 text-neutral-600 dark:border-neutral-700 dark:text-neutral-300";
  return (
    <div role="radiogroup" aria-label={t.locale.label} aria-busy={pending} className={`flex gap-1 text-xs ${className}`}>
      {LOCALES.map((locale) => (
        <button
          key={locale}
          type="button"
          role="radio"
          aria-checked={locale === current}
          title={t.locale.titles[locale]}
          lang={locale}
          disabled={pending}
          onClick={() => choose(locale)}
          className={`rounded-full px-2.5 py-1 font-semibold disabled:opacity-60 ${locale === current ? "bg-primary text-white" : idle}`}
        >
          {t.locale.names[locale]}
        </button>
      ))}
    </div>
  );
}
