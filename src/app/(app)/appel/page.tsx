import type { Metadata } from "next";

import { PremiumCallCard } from "@/components/tutor/premium-call-card";
import { getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: `${t.premiumCall.title} · ${t.app.name}` };
}

/** Appel voix avec le Prof : annoncé dans le menu, inclus dans les forfaits (activé avec la clé Gemini). */
export default async function PremiumCallPage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-5 px-4 py-8">
      <PremiumCallCard />
    </main>
  );
}
