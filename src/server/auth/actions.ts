"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { defaultCountry } from "@/config/countries";
import { INACTIVE_PARAM } from "@/config/session";
import type { AuthErrorKey } from "@/i18n/messages";
import { createServiceClient, createUserClient } from "@/lib/supabase/server";
import { enqueue } from "@/server/jobs/client";
import { QUEUES } from "@/server/jobs/queues";

import { randomInt } from "node:crypto";

import { CGU_VERSION, parseIdentifier, parseSignIn, parseSignUp, usernameBase } from "./schemas";

export interface FormState {
  errors?: Partial<Record<string, AuthErrorKey>>;
  formError?: AuthErrorKey;
  notice?: "checkEmail" | "resetSent" | "confirmationResent";
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
    fullName: field(formData, "fullName"),
    identifier: field(formData, "identifier"),
    cycle: field(formData, "cycle"),
    role: field(formData, "role"),
    guardianPhone: field(formData, "guardianPhone"),
    age: field(formData, "age"),
  };
  const parsed = parseSignUp(
    {
      ...values,
      password: field(formData, "password"),
      passwordConfirm: field(formData, "passwordConfirm"),
      acceptCgu: formData.get("acceptCgu"),
    },
    DEFAULT_COUNTRY,
  );
  if (!parsed.ok) return { errors: parsed.errors, values };
  const input = parsed.data;

  // Identifiant technique tiré du nom, rendu unique par des chiffres si besoin
  // (deux élèves peuvent porter le même nom).
  const username = await freeUsername(usernameBase(input.fullName));
  if (!username) return { formError: "unknown", values };

  const metadata = {
    username,
    full_name: input.fullName,
    cycle: input.cycle,
    role: input.role,
    country_code: input.countryCode,
    guardian_phone: input.guardianPhone,
    age: input.age,
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

  // Élève mineur : l'avis au parent (préparé par la base) part par le worker.
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
  // L'adresse revient pour l'écran « Confirme ton adresse e-mail ».
  return { notice: "checkEmail", values: { identifier: input.identifier.email } };
}

/** Premier identifiant libre : la base, puis la base suivie de 4 chiffres tirés au hasard. */
async function freeUsername(base: string): Promise<string | null> {
  const service = createServiceClient();
  const candidates = [base, ...Array.from({ length: 5 }, () => `${base}${randomInt(1000, 10000)}`)];
  for (const candidate of candidates) {
    const { count, error } = await service
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("username", candidate);
    if (error) return null;
    if (!count) return candidate;
  }
  return null;
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

  if (error) {
    // Ces deux refus n'arrivent qu'avec le bon mot de passe : les dire ne révèle rien
    // à quelqu'un qui ne le connaît pas.
    if (error.code === "email_not_confirmed") return { formError: "emailNotConfirmed", values };
    if (error.code === "phone_not_confirmed" && identifier.kind === "phone") {
      redirect(`/verification?telephone=${encodeURIComponent(identifier.phone)}`);
    }
    // Sinon, même message quel que soit le motif, pour ne pas révéler qu'un compte existe.
    return { formError: "invalidCredentials", values };
  }
  redirect("/tableau-de-bord");
}

/**
 * Renvoie le lien de confirmation d'un compte e-mail pas encore activé.
 * La réponse est la même que le compte existe ou non.
 */
export async function resendConfirmationAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = { identifier: field(formData, "identifier") };
  const identifier = parseIdentifier(values.identifier, DEFAULT_COUNTRY);
  if (identifier?.kind !== "email") return { errors: { identifier: "identifierInvalid" }, values };

  const supabase = await createUserClient();
  const origin = (await headers()).get("origin") ?? "";
  await supabase.auth.resend({
    type: "signup",
    email: identifier.email,
    options: { emailRedirectTo: `${origin}/auth/confirmation` },
  });
  return { notice: "confirmationResent", values };
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
