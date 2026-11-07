import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { createUserClient } from "@/lib/supabase/server";

const TYPES: readonly EmailOtpType[] = ["signup", "email", "recovery", "email_change", "invite", "magiclink"];

/** Seules les pages internes sont acceptées comme destination (pas de redirection ouverte). */
function safeNext(value: string | null): string {
  return value && value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\") ? value : "/tableau-de-bord";
}

/**
 * Lien reçu par e-mail (confirmation d'inscription, mot de passe oublié).
 * Accepte les deux formes de lien de Supabase :
 * - `?code=…` (lien par défaut, échange PKCE) ;
 * - `?token_hash=…&type=…` (modèle d'e-mail personnalisé
 *   {{ .SiteURL }}/auth/confirmation?token_hash={{ .TokenHash }}&type=signup).
 * `next` indique la page où aller ensuite (nouveau mot de passe, par exemple).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const next = safeNext(searchParams.get("next"));
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const supabase = await createUserClient();
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, request.url));
  } else if (tokenHash && type && TYPES.includes(type)) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    const destination = type === "recovery" ? "/nouveau-mot-de-passe" : next;
    if (!error) return NextResponse.redirect(new URL(destination, request.url));
  }
  return NextResponse.redirect(new URL("/connexion?erreur=lien", request.url));
}
