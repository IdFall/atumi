import type { Metadata } from "next";

import { NewPasswordForm } from "@/components/auth/password-reset-forms";
import { AuthShell } from "@/components/layout/auth-shell";
import { getMessages } from "@/i18n/messages";

const t = getMessages("fr");

export const metadata: Metadata = { title: `${t.auth.newPasswordTitle} · ${t.app.name}` };

/** Atteinte par le lien « mot de passe oublié » : la session de récupération est déjà ouverte. */
export default function NewPasswordPage() {
  return (
    <AuthShell title={t.auth.newPasswordTitle}>
      <NewPasswordForm />
    </AuthShell>
  );
}
