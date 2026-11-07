import type { Metadata } from "next";
import { Suspense } from "react";

import { VerifyPhoneForm } from "@/components/auth/verify-phone-form";
import { AuthShell } from "@/components/layout/auth-shell";
import { getMessages } from "@/i18n/messages";

const t = getMessages("fr");

export const metadata: Metadata = { title: `${t.auth.verifyTitle} · ${t.app.name}` };

export default function VerifyPage({ searchParams }: PageProps<"/verification">) {
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
