import Image from "next/image";
import Link from "next/link";

import type { TutorLanguage } from "@/config/countries";
import { getT } from "@/i18n/server";
import type { TutorMode } from "@/server/ai/prompts";
import { setTutorLanguageAction } from "@/server/tutor/actions";

const TABS = ["expliquer", "exercer", "decouvrir"] as const satisfies readonly TutorMode[];

/** En-tête commun : avatar, langue de réponse, modes. */
export async function TutorHeader({
  mode,
  language,
  languages,
  scopeQuery,
}: {
  mode: TutorMode;
  language: TutorLanguage;
  languages: readonly TutorLanguage[];
  /** Paramètres module/chapitre à garder en changeant de mode. */
  scopeQuery: string;
}) {
  const t = await getT();
  const activeTab = mode === "approfondir" ? "expliquer" : mode;
  return (
    <header className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Image src="/prof-atumi.svg" alt={t.tutor.avatarAlt} width={48} height={48} priority />
        <div className="flex flex-col">
          <h1 className="text-xl font-bold">{t.tutor.name}</h1>
          <span className="text-sm text-neutral-600 dark:text-neutral-300">{t.tutor.subtitle}</span>
          <Link href="/a-propos#prof" className="text-xs font-medium text-primary dark:text-lavande">
            {t.tutor.whoIs}
          </Link>
        </div>
      </div>

      <form action={setTutorLanguageAction} role="radiogroup" aria-label={t.tutor.languageLabel} className="flex flex-wrap gap-1.5 text-sm">
        {languages.map((lang) => (
          <button
            key={lang}
            type="submit"
            name="language"
            value={lang}
            role="radio"
            aria-checked={lang === language}
            className={`rounded-full px-3 py-1 ${
              lang === language ? "bg-primary font-semibold text-white" : "border border-neutral-300 dark:border-neutral-700"
            }`}
          >
            {t.tutor.languages[lang]}
            {lang === "wo" ? <span className={`ml-1 text-xs ${lang === language ? "text-primary-soft" : "text-primary dark:text-lavande"}`}>{t.tutor.betaBadge}</span> : null}
          </button>
        ))}
      </form>
      <p role="status" className="-mt-1 text-xs text-neutral-600 dark:text-neutral-300">
        {t.tutor.languageNotice.replace("{language}", t.tutor.languageNames[language])}
      </p>

      <nav className="flex gap-1 rounded-xl bg-neutral-100 p-1 text-sm dark:bg-neutral-800">
        {TABS.map((tab) => (
          <Link
            key={tab}
            href={`/professeur?mode=${tab}${tab === "decouvrir" ? "" : scopeQuery}`}
            aria-current={tab === activeTab ? "page" : undefined}
            className={`flex-1 rounded-lg py-1.5 text-center font-semibold ${
              tab === activeTab ? "bg-white shadow-sm dark:bg-neutral-900" : "text-neutral-600 dark:text-neutral-300"
            }`}
          >
            {t.tutor.modes[tab]}
          </Link>
        ))}
      </nav>
    </header>
  );
}
