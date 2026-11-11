import type { Metadata } from "next";
import { Suspense } from "react";

import { PremiumCallCard } from "@/components/tutor/premium-call-card";
import { getCountry } from "@/config/countries";
import { DATE_LOCALES } from "@/i18n/messages";
import { getLocale, getT } from "@/i18n/server";
import { formatMoney } from "@/lib/money";
import { getCurrentUser } from "@/server/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: `${t.premiumCall.title} · ${t.app.name}` };
}

/** Appel voix avec le Prof : annoncé dans le menu, réservé à l'abonnement Premium (pas encore activé). */
export default async function PremiumCallPage() {
  const t = await getT();
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-5 px-4 py-8">
      <Suspense fallback={<p>{t.dashboard.loading}</p>}>
        <PremiumCallContent />
      </Suspense>
    </main>
  );
}

async function PremiumCallContent() {
  const [locale, user] = await Promise.all([getLocale(), getCurrentUser()]);
  const country = getCountry(user.countryCode);
  // Espaces insécables : le prix ne se coupe pas en fin de ligne (« 10 / 000 F CFA »).
  const price = country?.premiumPriceMinor
    ? formatMoney(country.premiumPriceMinor, country.currency, DATE_LOCALES[locale]).replace(/\s/g, "\u00a0")
    : null;
  return <PremiumCallCard price={price} />;
}
