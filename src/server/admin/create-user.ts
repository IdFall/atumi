"use server";

import { revalidatePath } from "next/cache";

import { defaultCountry } from "@/config/countries";
import type { AuthErrorKey } from "@/i18n/messages";
import { createServiceClient, createUserClient } from "@/lib/supabase/server";
import { CGU_VERSION, parseSignUp, usernameBase } from "@/server/auth/schemas";
import { freeUsername } from "@/server/auth/username";
import { enqueue } from "@/server/jobs/client";
import { QUEUES } from "@/server/jobs/queues";

import { ADMIN_CREATE_ROLES, type AdminCreateRole } from "./schemas";

/**
 * Création d'un compte par un administrateur (back office), avec un rôle :
 * élève, enseignant ou administrateur. Mêmes règles que l'inscription
 * (prénom et nom, âge, niveau, avis au parent d'un élève mineur), mais
 * l'adresse e-mail est confirmée tout de suite et l'administrateur choisit
 * un mot de passe provisoire à transmettre à la personne.
 * Un administrateur est un compte enseignant (majeur) inscrit dans `admins`.
 */

export interface CreateUserState {
  errors?: Partial<Record<string, AuthErrorKey>>;
  formError?: "forbidden" | "unknown";
  created?: { fullName: string; email: string; role: AdminCreateRole; password: string };
  /** Valeurs à réafficher après une erreur (jamais le mot de passe). */
  values?: Record<string, string>;
}

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function createUserAction(_prev: CreateUserState, formData: FormData): Promise<CreateUserState> {
  // Le rôle administrateur est vérifié en base, avec la session de la personne connectée.
  const supabase = await createUserClient();
  const { data: claims } = await supabase.auth.getClaims();
  const adminId = claims?.claims?.sub;
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!adminId || isAdmin !== true) return { formError: "forbidden" };

  const roleInput = field(formData, "role");
  const role: AdminCreateRole = (ADMIN_CREATE_ROLES as readonly string[]).includes(roleInput) ? (roleInput as AdminCreateRole) : "eleve";
  const values = {
    fullName: field(formData, "fullName"),
    identifier: field(formData, "email"),
    cycle: field(formData, "cycle"),
    role,
    age: field(formData, "age"),
    guardianPhone: field(formData, "guardianPhone"),
  };
  const password = field(formData, "password");
  const parsed = parseSignUp(
    {
      ...values,
      // Un administrateur suit les règles d'un enseignant : majeur, sans accord parental.
      role: role === "admin" ? "enseignant" : role,
      password,
      passwordConfirm: password,
      acceptCgu: true,
    },
    defaultCountry().code,
    { phoneSignUpOpen: false },
  );
  if (!parsed.ok) {
    const { identifier, ...rest } = parsed.errors;
    return { errors: { ...rest, ...(identifier ? { email: identifier } : {}) }, values };
  }
  const input = parsed.data;
  if (input.identifier.kind !== "email") return { errors: { email: "emailInvalid" }, values };

  const username = await freeUsername(usernameBase(input.fullName));
  if (!username) return { formError: "unknown", values };

  const service = createServiceClient();
  const { data, error } = await service.auth.admin.createUser({
    email: input.identifier.email,
    password: input.password,
    email_confirm: true,
    user_metadata: {
      username,
      full_name: input.fullName,
      cycle: input.cycle,
      role: input.role,
      country_code: input.countryCode,
      guardian_phone: input.guardianPhone,
      age: input.age,
      is_adult: input.isAdult,
      // Les CGU sont présentées à la personne par l'administrateur qui crée le compte.
      cgu_accepted: true,
      cgu_version: CGU_VERSION,
      created_by_admin: adminId,
    },
  });
  if (error || !data.user) {
    if (error?.code === "email_exists" || error?.code === "user_already_exists") {
      return { errors: { email: "identifierTaken" }, values };
    }
    console.error("[admin] création de compte refusée", error?.code ?? error?.message);
    return { formError: "unknown", values };
  }
  const userId = data.user.id;

  if (role === "admin") {
    const { error: adminError } = await service.from("admins").insert({ user_id: userId });
    if (adminError) {
      console.error("[admin] rôle administrateur non attribué", adminError.message);
      return { formError: "unknown", values };
    }
  }

  // Journal de l'administration (lu dans /admin/journal).
  await service.from("admin_actions").insert({
    user_id: adminId,
    action: "compte_cree",
    target_user_id: userId,
    details: { role, cycle: input.cycle },
  });

  if (input.guardianPhone) {
    try {
      await enqueue(QUEUES.parentNotify, { userId });
    } catch (enqueueError) {
      console.error("[admin] avis au parent non déposé", enqueueError);
    }
  }

  revalidatePath("/admin", "layout");
  return { created: { fullName: input.fullName, email: input.identifier.email, role, password: input.password } };
}
