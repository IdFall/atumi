import type { Metadata } from "next";

import { LegalPage } from "@/components/legal/legal-page";
import { getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: `${t.legal.terms.title} · ${t.app.name}` };
}

/** Page publique : texte dans src/i18n/messages.ts (legal.terms), FR et EN. */
export default async function ConditionsPage() {
  const t = await getT();
  return <LegalPage text={t.legal.terms} legal={t.legal} appName={t.app.name} />;
}
