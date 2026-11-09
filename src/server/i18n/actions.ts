"use server";

import { cookies } from "next/headers";

import { createUserClient } from "@/lib/supabase/server";
import { isLocale, LOCALE_COOKIE } from "@/i18n/server";

/** Change la langue de l'interface : cookie (aussi avant connexion) et profil si connecté. */
export async function setLocaleAction(formData: FormData): Promise<void> {
  const locale = formData.get("locale");
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });

  const supabase = await createUserClient();
  const { data } = await supabase.auth.getUser();
  if (data.user) await supabase.from("profiles").update({ locale }).eq("id", data.user.id);
}
