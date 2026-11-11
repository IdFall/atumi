import "server-only";

import { createUserClient } from "@/lib/supabase/server";

/** Forfaits proposés et demandes de paiement de l'utilisateur connecté (RLS). */

export interface OfferedPlan {
  code: string;
  kind: "abonnement" | "recharge";
  label: string;
  priceMinor: number;
  currency: string;
  durationDays: number;
  quizLimit: number | null;
  quizQuestionLimit: number | null;
  documentLimit: number | null;
  tutorMessageLimit: number | null;
  researchDailyLimit: number | null;
  /** Abonnement : minutes par période ; recharge : minutes ajoutées. null = sans limite. */
  callMinutesLimit: number | null;
  /** Abonnement : espace (cours + bibliothèque) ; recharge : espace ajouté. null = sans limite. */
  storageBytes: number | null;
}

/** Forfaits et recharges en vente dans le pays (les forfaits actifs sont lisibles par RLS). */
export async function listOfferedPlans(countryCode: string): Promise<OfferedPlan[]> {
  const supabase = await createUserClient();
  const { data, error } = await supabase
    .from("plans")
    .select(
      "code, kind, label, price_minor, currency, duration_days, quiz_limit, quiz_question_limit, document_limit, tutor_message_limit, research_daily_limit, call_minutes_limit, library_bytes_limit",
    )
    .eq("country_code", countryCode)
    .in("kind", ["abonnement", "recharge"])
    .order("price_minor");
  if (error) throw error;
  return (data ?? []).map((p) => ({
    code: p.code,
    kind: p.kind as OfferedPlan["kind"],
    label: p.label,
    priceMinor: Number(p.price_minor),
    currency: p.currency,
    durationDays: p.duration_days,
    quizLimit: p.quiz_limit,
    quizQuestionLimit: p.quiz_question_limit,
    documentLimit: p.document_limit,
    tutorMessageLimit: p.tutor_message_limit,
    researchDailyLimit: p.research_daily_limit,
    callMinutesLimit: p.call_minutes_limit,
    storageBytes: p.library_bytes_limit === null ? null : Number(p.library_bytes_limit),
  }));
}

/** Ce qu'il reste à l'utilisateur sur son droit en cours (null : pas de droit en cours). */
export interface MyUsage {
  storageUsed: number;
  storageLimit: number | null;
  messagesUsed: number;
  messageLimit: number | null;
  /** Secondes d'appel restantes (forfait + recharges) ; null = sans limite. */
  callSecondsLeft: number | null;
  /** Minutes d'appel du forfait ; 0 = non inclus. */
  callMinutesLimit: number | null;
}

export async function getMyUsage(): Promise<MyUsage | null> {
  const supabase = await createUserClient();
  const [space, usage, call] = await Promise.all([
    supabase.rpc("library_quota").maybeSingle<{ bytes_limit: number | null; used: number }>(),
    supabase.rpc("plan_usage").maybeSingle<{ tutor_messages_used: number; tutor_message_limit: number | null }>(),
    supabase.rpc("call_quota").maybeSingle<{ minutes_limit: number | null; seconds_remaining: number | null }>(),
  ]);
  if (!space.data || !usage.data) return null;
  return {
    storageUsed: Number(space.data.used),
    storageLimit: space.data.bytes_limit === null ? null : Number(space.data.bytes_limit),
    messagesUsed: usage.data.tutor_messages_used,
    messageLimit: usage.data.tutor_message_limit,
    callSecondsLeft: call.data ? call.data.seconds_remaining : 0,
    callMinutesLimit: call.data ? call.data.minutes_limit : 0,
  };
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
