"use server";

import { cookies } from "next/headers";

import { isTutorLanguageOffered } from "@/config/countries";
import { createUserClient } from "@/lib/supabase/server";
import { isLocale, LOCALE_COOKIE } from "@/i18n/server";

/** Change la langue de l'interface : cookie (aussi avant connexion) et profil si connecté, Prof NEO compris. */
export async function setLocaleAction(formData: FormData): Promise<void> {
  const locale = formData.get("locale");
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });

  const supabase = await createUserClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;
  // Le Prof NEO répond dans la langue de l'interface choisie, si elle est proposée dans le pays.
  const { data: profile } = await supabase.from("profiles").select("country_code").eq("id", data.user.id).single();
  const tutor = profile && isTutorLanguageOffered(profile.country_code, locale) ? { tutor_language: locale } : {};
  await supabase.from("profiles").update({ locale, ...tutor }).eq("id", data.user.id);
}
