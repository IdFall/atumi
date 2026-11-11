"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { defaultCountry } from "@/config/countries";
import { INACTIVE_PARAM } from "@/config/session";
import type { AuthErrorKey } from "@/i18n/messages";
import { createServiceClient, createUserClient } from "@/lib/supabase/server";
import { enqueue } from "@/server/jobs/client";
import { QUEUES } from "@/server/jobs/queues";

import { CGU_VERSION, parseIdentifier, parseSignIn, parseSignUp } from "./schemas";

export interface FormState {
  errors?: Partial<Record<string, AuthErrorKey>>;
  formError?: AuthErrorKey;
  notice?: "checkEmail" | "resetSent";
  /** Valeurs à réafficher (jamais le mot de passe). */
  values?: Record<string, string>;
}

const DEFAULT_COUNTRY = defaultCountry().code;

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function signUpAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = {
    username: field(formData, "username"),
    identifier: field(formData, "identifier"),
    cycle: field(formData, "cycle"),
    role: field(formData, "role"),
    guardianPhone: field(formData, "guardianPhone"),
    isAdult: field(formData, "isAdult"),
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
    role: input.role,
    country_code: input.countryCode,
    guardian_phone: input.guardianPhone,
    is_adult: input.isAdult,
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

  // Lycéen mineur : l'avis au parent (préparé par la base) part par le worker.
  if (input.guardianPhone && data.user) {
    try {
      await enqueue(QUEUES.parentNotify, { userId: data.user.id });
    } catch (enqueueError) {
      // L'inscription reste valable : le worker reprend les avis non envoyés.
      console.error("[inscription] avis au parent non déposé", enqueueError);
    }
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

/** Après le lien reçu par e-mail, l'apprenant choisit un nouveau mot de passe. */
const PASSWORD_RESET_PATH = "/nouveau-mot-de-passe";

/**
 * Mot de passe oublié : envoie un lien de réinitialisation.
 * La réponse est la même que le compte existe ou non (pas de fuite d'information).
 */
export async function requestPasswordResetAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = { identifier: field(formData, "identifier") };
  const identifier = parseIdentifier(values.identifier, DEFAULT_COUNTRY);
  if (!identifier) return { errors: { identifier: "identifierInvalid" }, values };
  if (identifier.kind === "phone") return { formError: "resetPhoneUnsupported", values };

  const supabase = await createUserClient();
  const origin = (await headers()).get("origin") ?? "";
  await supabase.auth.resetPasswordForEmail(identifier.email, {
    redirectTo: `${origin}/auth/confirmation?next=${encodeURIComponent(PASSWORD_RESET_PATH)}`,
  });
  return { notice: "resetSent" };
}

export async function updatePasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const password = field(formData, "password");
  if (password.length < 8 || password.length > 72) return { errors: { password: "passwordLength" } };

  const supabase = await createUserClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { formError: error.code === "same_password" ? "samePassword" : "resetLinkExpired" };
  }
  redirect("/tableau-de-bord");
}

export async function signOutAction(): Promise<void> {
  const supabase = await createUserClient();
  // « local » : ferme la session de cet appareil sans dépendre d'un appel réseau qui échouerait.
  await supabase.auth.signOut({ scope: "local" });
  // Déconnexion volontaire : retour à l'accueil public.
  redirect("/");
}

/** Déconnexion automatique après 1 h sans activité, demandée par le navigateur (`IdleSignOut`). */
export async function inactiveSignOutAction(): Promise<void> {
  const supabase = await createUserClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect(`/connexion?${INACTIVE_PARAM}=1`);
}
