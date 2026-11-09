import type { Metadata } from "next";

import { SignUpForm } from "@/components/auth/sign-up-form";
import { AuthShell } from "@/components/layout/auth-shell";
import { getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: `${t.auth.signUpTitle} · ${t.app.name}` };
}

export default async function SignUpPage() {
  const t = await getT();
  return (
    <AuthShell title={t.auth.signUpTitle}>
      <SignUpForm />
    </AuthShell>
  );
}
