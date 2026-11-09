import type { Metadata } from "next";

import { InactiveNotice } from "@/components/auth/inactive-notice";
import { SignInForm } from "@/components/auth/sign-in-form";
import { AuthShell } from "@/components/layout/auth-shell";
import { getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: `${t.auth.signInTitle} · ${t.app.name}` };
}

export default async function SignInPage() {
  const t = await getT();
  return (
    <AuthShell title={t.auth.signInTitle}>
      <InactiveNotice />
      <SignInForm />
    </AuthShell>
  );
}
