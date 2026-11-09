import type { Metadata } from "next";

import { ResetRequestForm } from "@/components/auth/password-reset-forms";
import { AuthShell } from "@/components/layout/auth-shell";
import { getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: `${t.auth.resetTitle} · ${t.app.name}` };
}

export default async function ForgotPasswordPage() {
  const t = await getT();
  return (
    <AuthShell title={t.auth.resetTitle}>
      <ResetRequestForm />
    </AuthShell>
  );
}
