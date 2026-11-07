import type { Metadata } from "next";

import { ResetRequestForm } from "@/components/auth/password-reset-forms";
import { AuthShell } from "@/components/layout/auth-shell";
import { getMessages } from "@/i18n/messages";

const t = getMessages("fr");

export const metadata: Metadata = { title: `${t.auth.resetTitle} · ${t.app.name}` };

export default function ForgotPasswordPage() {
  return (
    <AuthShell title={t.auth.resetTitle}>
      <ResetRequestForm />
    </AuthShell>
  );
}
