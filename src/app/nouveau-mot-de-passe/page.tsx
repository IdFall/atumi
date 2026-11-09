import type { Metadata } from "next";

import { NewPasswordForm } from "@/components/auth/password-reset-forms";
import { AuthShell } from "@/components/layout/auth-shell";
import { getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: `${t.auth.newPasswordTitle} · ${t.app.name}` };
}

/** Atteinte par le lien « mot de passe oublié » : la session de récupération est déjà ouverte. */
export default async function NewPasswordPage() {
  const t = await getT();
  return (
    <AuthShell title={t.auth.newPasswordTitle}>
      <NewPasswordForm />
    </AuthShell>
  );
}
