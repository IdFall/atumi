"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { activeCountries } from "@/config/countries";
import type { AuthErrorKey } from "@/i18n/messages";
import { createServiceClient, createUserClient } from "@/lib/supabase/server";

import { CGU_VERSION, parseIdentifier, parseSignIn, parseSignUp } from "./schemas";

export interface FormState {
  errors?: Partial<Record<string, AuthErrorKey>>;
  formError?: AuthErrorKey;
  notice?: "checkEmail";
  /** Valeurs à réafficher (jamais le mot de passe). */
  values?: Record<string, string>;
}

const DEFAULT_COUNTRY = activeCountries()[0]?.code ?? "SN";

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function signUpAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = {
    username: field(formData, "username"),
    identifier: field(formData, "identifier"),
    cycle: field(formData, "cycle"),
    guardianPhone: field(formData, "guardianPhone"),
  };
  const parsed = parseSignUp(
    { ...values, password: field(formData, "password"), acceptCgu: formData.get("acceptCgu") },
    DEFAULT_COUNTRY,
  );
  if (!parsed.ok) return { errors: parsed.errors, values };
  const input = parsed.data;

  // Message clair si le pseudo est pris (sinon la base refuserait l'inscription sans détail).
  const { count } = await createServiceClient()
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("username", input.username);
  if (count) return { errors: { username: "usernameTaken" }, values };

  const metadata = {
    username: input.username,
    cycle: input.cycle,
    country_code: input.countryCode,
    guardian_phone: input.guardianPhone,
    cgu_accepted: true,
    cgu_version: CGU_VERSION,
  };

  const supabase = await createUserClient();
  const origin = (await headers()).get("origin") ?? "";
  const { data, error } =
    input.identifier.kind === "email"
      ? await supabase.auth.signUp({
          email: input.identifier.email,
          password: input.password,
          options: { data: metadata, emailRedirectTo: `${origin}/auth/confirmation` },
        })
      : await supabase.auth.signUp({
          phone: input.identifier.phone,
          password: input.password,
          options: { data: metadata },
        });

  if (error) {
    if (error.code === "user_already_exists" || error.code === "phone_exists" || error.code === "email_exists") {
      return { errors: { identifier: "identifierTaken" }, values };
    }
    return { formError: "unknown", values };
  }

  if (data.session) redirect("/tableau-de-bord");
  if (input.identifier.kind === "phone") {
    redirect(`/verification?telephone=${encodeURIComponent(input.identifier.phone)}`);
  }
  return { notice: "checkEmail" };
}

export async function signInAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = { identifier: field(formData, "identifier") };
  const parsed = parseSignIn({ ...values, password: field(formData, "password") }, DEFAULT_COUNTRY);
  if (!parsed.ok) return { errors: parsed.errors, values };

  const { identifier, password } = parsed.data;
  const supabase = await createUserClient();
  const { error } =
    identifier.kind === "email"
      ? await supabase.auth.signInWithPassword({ email: identifier.email, password })
      : await supabase.auth.signInWithPassword({ phone: identifier.phone, password });

  // Même message quel que soit le motif, pour ne pas révéler qu'un compte existe.
  if (error) return { formError: "invalidCredentials", values };
  redirect("/tableau-de-bord");
}

export async function verifyPhoneAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = { telephone: field(formData, "telephone") };
  const identifier = parseIdentifier(values.telephone, DEFAULT_COUNTRY);
  const token = field(formData, "code").replace(/\s/g, "");
  if (identifier?.kind !== "phone" || !/^[0-9]{4,8}$/.test(token)) {
    return { formError: "invalidCode", values };
  }

  const supabase = await createUserClient();
  const { error } = await supabase.auth.verifyOtp({ phone: identifier.phone, token, type: "sms" });
  if (error) return { formError: "invalidCode", values };
  redirect("/tableau-de-bord");
}

export async function signOutAction(): Promise<void> {
  const supabase = await createUserClient();
  await supabase.auth.signOut();
  redirect("/");
}
