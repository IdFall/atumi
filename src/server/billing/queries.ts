import "server-only";

import { createUserClient } from "@/lib/supabase/server";

/** Forfaits proposés et demandes de paiement de l'utilisateur connecté (RLS). */

export interface OfferedPlan {
  code: string;
  label: string;
  priceMinor: number;
  currency: string;
  durationDays: number;
  quizLimit: number | null;
  documentLimit: number | null;
  tutorMessageLimit: number | null;
  callMinutesLimit: number | null;
}

export async function listOfferedPlans(countryCode: string): Promise<OfferedPlan[]> {
  const supabase = await createUserClient();
  const { data, error } = await supabase
    .from("plans")
    .select("code, label, price_minor, currency, duration_days, quiz_limit, document_limit, tutor_message_limit, call_minutes_limit")
    .eq("country_code", countryCode)
    .eq("kind", "abonnement")
    .order("price_minor");
  if (error) throw error;
  return (data ?? []).map((p) => ({
    code: p.code,
    label: p.label,
    priceMinor: Number(p.price_minor),
    currency: p.currency,
    durationDays: p.duration_days,
    quizLimit: p.quiz_limit,
    documentLimit: p.document_limit,
    tutorMessageLimit: p.tutor_message_limit,
    callMinutesLimit: p.call_minutes_limit,
  }));
}

export type PaymentRequestStatus = "en_attente" | "validee" | "refusee";

export interface MyPaymentRequest {
  id: string;
  planLabel: string;
  provider: string;
  reference: string;
  status: PaymentRequestStatus;
  createdAt: string;
}

export async function listMyPaymentRequests(): Promise<MyPaymentRequest[]> {
  const supabase = await createUserClient();
  const { data, error } = await supabase
    .from("payment_requests")
    .select("id, provider, reference, status, created_at, plans(label)")
    .order("created_at", { ascending: false })
    .limit(5);
  if (error) throw error;
  return (data ?? []).map((r) => {
    const plan = Array.isArray(r.plans) ? r.plans[0] : r.plans;
    return {
      id: r.id,
      planLabel: (plan as { label?: string } | null)?.label ?? "",
      provider: r.provider,
      reference: r.reference,
      status: r.status as PaymentRequestStatus,
      createdAt: r.created_at,
    };
  });
}
