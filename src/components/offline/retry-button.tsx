"use client";

import { useT } from "@/i18n/client";

/** Recharge la page demandée quand la connexion revient. */
export function RetryButton() {
  const t = useT();
  return (
    <button
      type="button"
      onClick={() => window.location.reload()}
      className="self-start rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-strong"
    >
      {t.offline.retry}
    </button>
  );
}
