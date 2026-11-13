import { z } from "zod";

import type { AdminErrorKey } from "@/i18n/messages";
import { majorToMinor } from "@/lib/money";

/** Moyens de paiement saisis à la main, en plus de ceux du pays. */
export const MANUAL_PROVIDERS = ["especes", "interne"] as const;

/** Périodes proposées dans les pages d'administration (jours). */
export const ADMIN_PERIODS = ["7", "30", "90"] as const;
export type AdminPeriod = (typeof ADMIN_PERIODS)[number];

export function parsePeriod(value: unknown): AdminPeriod {
  return ADMIN_PERIODS.find((p) => p === value) ?? "30";
}

/** Message d'erreur de la base vers une clé du dictionnaire. */
export function adminErrorKey(error: { message?: string; code?: string } | null | undefined): AdminErrorKey {
  const message = error?.message ?? "";
  if (message.includes("ATUMI_ADMIN_REFUSE")) return "refused";
  if (message.includes("ATUMI_FORFAIT_CODE_INVALIDE")) return "planCode";
  if (message.includes("ATUMI_FORFAIT_INCONNU")) return "unknownPlan";
  if (message.includes("ATUMI_ELEVE_INCONNU")) return "unknownUser";
  if (message.includes("ATUMI_PAIEMENT_INVALIDE")) return "invalidPayment";
  if (message.includes("ATUMI_DEMANDE_INCONNUE")) return "unknownRequest";
  if (error?.code === "23505") return "duplicateReference";
  if (error?.code === "23514") return "invalidNumber";
  return "unknown";
}

/** Limite saisie : vide = sans limite (null), sinon entier positif ou nul. */
const limit = z
  .string()
  .trim()
  .transform((v, ctx) => {
    if (v === "") return null;
    if (!/^\d{1,6}$/.test(v)) {
      ctx.addIssue({ code: "custom" });
      return z.NEVER;
    }
    return Number(v);
  });

export interface PlanInput {
  code: string;
  countryCode: string;
  label: string;
  priceMinor: number;
  durationDays: number;
  quizLimit: number | null;
  documentLimit: number | null;
  tutorMessageLimit: number | null;
  quizQuestionLimit: number | null;
  callMinutesLimit: number | null;
  isActive: boolean;
}

const planSchema = z.object({
  code: z.string().trim().toLowerCase().regex(/^[a-z]{2}-[a-z0-9-]{2,40}$/),
  countryCode: z.string().trim().regex(/^[A-Z]{2}$/),
  label: z.string().trim().min(1).max(80),
  durationDays: z.string().trim().regex(/^\d{1,4}$/).transform(Number).pipe(z.number().int().min(1)),
  quizLimit: limit,
  documentLimit: limit,
  tutorMessageLimit: limit,
  quizQuestionLimit: limit,
  callMinutesLimit: limit,
});

/** Formulaire « forfait » ; la devise vient du pays. */
export function parsePlanForm(
  get: (name: string) => string,
  currency: string,
): { ok: true; plan: PlanInput } | { ok: false; error: AdminErrorKey } {
  const parsed = planSchema.safeParse({
    code: get("code"),
    countryCode: get("countryCode"),
    label: get("label"),
    durationDays: get("durationDays"),
    quizLimit: get("quizLimit"),
    documentLimit: get("documentLimit"),
    tutorMessageLimit: get("tutorMessageLimit"),
    quizQuestionLimit: get("quizQuestionLimit"),
    callMinutesLimit: get("callMinutesLimit"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.some((i) => i.path[0] === "code") ? "planCode" : "invalidNumber" };
  }
  const priceMinor = majorToMinor(get("price"), currency);
  if (priceMinor === null) return { ok: false, error: "invalidNumber" };
  const q = parsed.data.quizQuestionLimit;
  if (q !== null && (q < 3 || q > 30)) return { ok: false, error: "invalidNumber" };
  return { ok: true, plan: { ...parsed.data, priceMinor, isActive: get("isActive") === "on" } };
}

/** Rôles proposés à la création d'un compte par un administrateur (back office). */
export const ADMIN_CREATE_ROLES = ["eleve", "enseignant", "admin"] as const;
export type AdminCreateRole = (typeof ADMIN_CREATE_ROLES)[number];
