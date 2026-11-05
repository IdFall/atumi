import type { Metadata } from "next";

import { SignUpForm } from "@/components/auth/sign-up-form";
import { AuthShell } from "@/components/layout/auth-shell";
import { getMessages } from "@/i18n/messages";

const t = getMessages("fr");

export const metadata: Metadata = { title: `${t.auth.signUpTitle} · ${t.app.name}` };

export default function SignUpPage() {
  return (
    <AuthShell title={t.auth.signUpTitle}>
      <SignUpForm />
    </AuthShell>
  );
}
