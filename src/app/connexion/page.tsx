import type { Metadata } from "next";

import { SignInForm } from "@/components/auth/sign-in-form";
import { AuthShell } from "@/components/layout/auth-shell";
import { getMessages } from "@/i18n/messages";

const t = getMessages("fr");

export const metadata: Metadata = { title: `${t.auth.signInTitle} · ${t.app.name}` };

export default function SignInPage() {
  return (
    <AuthShell title={t.auth.signInTitle}>
      <SignInForm />
    </AuthShell>
  );
}
