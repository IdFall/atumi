import type { Metadata } from "next";
import { Suspense } from "react";

import { VerifyPhoneForm } from "@/components/auth/verify-phone-form";
import { AuthShell } from "@/components/layout/auth-shell";
import { getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: `${t.auth.verifyTitle} · ${t.app.name}` };
}

export default async function VerifyPage({ searchParams }: PageProps<"/verification">) {
  const t = await getT();
  return (
    <AuthShell title={t.auth.verifyTitle}>
      <Suspense fallback={<p>{t.dashboard.loading}</p>}>
        <PhoneForm searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}

async function PhoneForm({ searchParams }: { searchParams: PageProps<"/verification">["searchParams"] }) {
  const { telephone } = await searchParams;
  return <VerifyPhoneForm phone={typeof telephone === "string" ? telephone : ""} />;
}
