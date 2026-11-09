"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCountry } from "@/config/countries";
import type { AdminErrorKey, AdminNoticeKey } from "@/i18n/messages";
import { majorToMinor } from "@/lib/money";
import { createUserClient } from "@/lib/supabase/server";
import { requireUserId } from "@/server/auth/session";

import { adminErrorKey, parsePlanForm } from "./schemas";

/**
 * Actions de l'administration. La base vérifie le rôle administrateur et inscrit
 * chaque action au journal ; ici on ne fait que lire le formulaire et revenir
 * à la page avec un message (?ok=… ou ?erreur=…).
 */

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

/** Revient à une page /admin (jamais ailleurs) avec un message. */
function back(formData: FormData, result: { ok: AdminNoticeKey } | { error: AdminErrorKey }): never {
  const target = field(formData, "returnTo");
  const url = new URL(target.startsWith("/admin") ? target : "/admin", "http://atumi.local");
  url.searchParams.delete("ok");
  url.searchParams.delete("erreur");
  if ("ok" in result) url.searchParams.set("ok", result.ok);
  else url.searchParams.set("erreur", result.error);
  revalidatePath("/admin", "layout");
  redirect(`${url.pathname}${url.search}`);
}

export async function grantPlanAction(formData: FormData): Promise<void> {
  await requireUserId();
  const amountInput = field(formData, "amount").trim();
  const currency = field(formData, "currency");
  let amount: number | null = null;
  if (amountInput !== "") {
    amount = majorToMinor(amountInput, currency);
    if (amount === null) back(formData, { error: "invalidNumber" });
  }

  const supabase = await createUserClient();
  const { error } = await supabase.rpc("admin_grant_plan", {
    p_user: field(formData, "userId"),
    p_plan_code: field(formData, "planCode"),
    p_provider: field(formData, "provider"),
    p_reference: field(formData, "reference").trim(),
    p_amount_minor: amount,
  });
  back(formData, error ? { error: adminErrorKey(error) } : { ok: "granted" });
}

export async function cancelSubscriptionAction(formData: FormData): Promise<void> {
  await requireUserId();
  const supabase = await createUserClient();
  const { error } = await supabase.rpc("admin_cancel_subscription", { p_id: field(formData, "subscriptionId") });
  back(formData, error ? { error: adminErrorKey(error) } : { ok: "cancelled" });
}

export async function savePlanAction(formData: FormData): Promise<void> {
  await requireUserId();
  const country = getCountry(field(formData, "countryCode"));
  if (!country) back(formData, { error: "unknown" });
  const parsed = parsePlanForm((name) => field(formData, name), country.currency);
  if (!parsed.ok) back(formData, { error: parsed.error });

  const p = parsed.plan;
  const supabase = await createUserClient();
  const { error } = await supabase.rpc("admin_save_plan", {
    p_code: p.code,
    p_country_code: p.countryCode,
    p_label: p.label,
    p_price_minor: p.priceMinor,
    p_duration_days: p.durationDays,
    p_quiz_limit: p.quizLimit,
    p_document_limit: p.documentLimit,
    p_tutor_message_limit: p.tutorMessageLimit,
    p_quiz_question_limit: p.quizQuestionLimit,
    p_call_minutes_limit: p.callMinutesLimit,
    p_is_active: p.isActive,
  });
  back(formData, error ? { error: adminErrorKey(error) } : { ok: "planSaved" });
}

export async function setSupportStatusAction(formData: FormData): Promise<void> {
  await requireUserId();
  const supabase = await createUserClient();
  const { error } = await supabase.rpc("admin_set_support_status", {
    p_id: Number(field(formData, "id")),
    p_status: field(formData, "status"),
  });
  back(formData, error ? { error: adminErrorKey(error) } : { ok: "messageUpdated" });
}

export async function confirmPaymentAction(formData: FormData): Promise<void> {
  await requireUserId();
  const supabase = await createUserClient();
  const { error } = await supabase.rpc("admin_confirm_payment_request", { p_id: field(formData, "requestId") });
  back(formData, error ? { error: adminErrorKey(error) } : { ok: "paymentConfirmed" });
}

export async function rejectPaymentAction(formData: FormData): Promise<void> {
  await requireUserId();
  const supabase = await createUserClient();
  const { error } = await supabase.rpc("admin_reject_payment_request", { p_id: field(formData, "requestId") });
  back(formData, error ? { error: adminErrorKey(error) } : { ok: "paymentRejected" });
}
