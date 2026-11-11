"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { SubscribeErrorKey } from "@/i18n/messages";
import { createUserClient } from "@/lib/supabase/server";
import { requireUserId } from "@/server/auth/session";

export interface PaymentRequestState {
  error?: SubscribeErrorKey;
  sent?: boolean;
}

const schema = z.object({
  planCode: z.string().min(1).max(60),
  provider: z.string().regex(/^[a-z_]{2,30}$/),
  reference: z.string().trim().min(3).max(80),
});

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

/** Déclare un paiement mobile money ; l'équipe le vérifie puis active le forfait. */
export async function requestPaymentAction(_prev: PaymentRequestState, formData: FormData): Promise<PaymentRequestState> {
  const userId = await requireUserId();
  const parsed = schema.safeParse({
    planCode: field(formData, "planCode"),
    provider: field(formData, "provider"),
    reference: field(formData, "reference"),
  });
  if (!parsed.success) return { error: parsed.error.issues.some((i) => i.path[0] === "reference") ? "reference" : "unknown" };

  const supabase = await createUserClient();
  const { error } = await supabase.from("payment_requests").insert({
    user_id: userId,
    plan_code: parsed.data.planCode,
    provider: parsed.data.provider,
    reference: parsed.data.reference,
  });
  if (error) {
    if (error.code === "23505") return { error: "duplicate" };
    if (error.message.includes("ATUMI_TROP_DE_DEMANDES")) return { error: "tooMany" };
    if (error.message.includes("ATUMI_RECHARGE_ABONNES")) return { error: "rechargeSubscribersOnly" };
    return { error: "unknown" };
  }
  revalidatePath("/abonnement");
  return { sent: true };
}
