import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { createUserClient } from "@/lib/supabase/server";

const TYPES: readonly EmailOtpType[] = ["signup", "email", "recovery", "email_change", "invite", "magiclink"];

/**
 * Lien de confirmation envoyé par e-mail.
 * Dans Supabase, le modèle d'e-mail doit pointer vers
 * {{ .SiteURL }}/auth/confirmation?token_hash={{ .TokenHash }}&type=signup
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  if (tokenHash && type && TYPES.includes(type)) {
    const supabase = await createUserClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) return NextResponse.redirect(new URL("/tableau-de-bord", request.url));
  }
  return NextResponse.redirect(new URL("/connexion?erreur=lien", request.url));
}
