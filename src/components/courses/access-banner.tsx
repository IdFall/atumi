import Link from "next/link";
import type { ReactNode } from "react";

import { getLocale, getT } from "@/i18n/server";
import type { Access } from "@/server/courses/queries";
import { DATE_LOCALES } from "@/i18n/messages";

/** Bandeau d'état de l'accès : essai à venir, essai en cours, abonnement, accès terminé. */
export async function AccessBanner({ access }: { access: Access }) {
  const t = await getT();
  if (access.state === "subscribed") {
    const date = new Date(access.endsAt).toLocaleDateString(DATE_LOCALES[await getLocale()], { day: "numeric", month: "long" });
    return <Banner tone="ok">{`${t.access.subscribed} ${date}.`}</Banner>;
  }
  if (access.state === "trial") {
    const minutes = access.minutesLeft;
    const left = minutes >= 60 ? `${Math.floor(minutes / 60)} ${t.access.hours}` : `${minutes} ${t.access.minutes}`;
    return (
      <Banner tone="info">
        {`${t.access.trialEndsIn} ${left}.`}{" "}
        <Link href="/abonnement" className="font-semibold underline">
          {t.subscribe.link}
        </Link>
      </Banner>
    );
  }
  if (access.state === "expired") {
    return (
      <Banner tone="warn">
        {t.access.expired}{" "}
        <Link href="/abonnement" className="font-semibold underline">
          {t.subscribe.link}
        </Link>
      </Banner>
    );
  }
  return <Banner tone="info">{t.access.trialNotStarted}</Banner>;
}

function Banner({ tone, children }: { tone: "ok" | "info" | "warn"; children: ReactNode }) {
  const styles = {
    ok: "bg-green-50 text-green-900 dark:bg-green-950 dark:text-green-100",
    info: "bg-orange-50 text-orange-900 dark:bg-orange-950 dark:text-orange-100",
    warn: "bg-red-50 text-red-900 dark:bg-red-950 dark:text-red-100",
  } as const;
  return (
    <p role="status" className={`rounded-xl p-3 text-sm ${styles[tone]}`}>
      {children}
    </p>
  );
}
