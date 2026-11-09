import "server-only";

import { notFound, redirect } from "next/navigation";
import { cache } from "react";

import { createUserClient } from "@/lib/supabase/server";

/**
 * Lectures de l'espace administrateur. Toutes passent par le client utilisateur :
 * chaque fonction de la base vérifie elle-même le rôle administrateur
 * (`require_admin`) et ne renvoie ni cours, ni quiz, ni conversation.
 */

/** Garde des pages /admin : connexion obligatoire, puis rôle administrateur (sinon 404). */
export const requireAdmin = cache(async (): Promise<void> => {
  const supabase = await createUserClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect("/connexion");
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (isAdmin !== true) notFound();
});

async function rpc<T>(name: string, args?: Record<string, unknown>): Promise<T> {
  const supabase = await createUserClient();
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(`${name} : ${error.message}`);
  return data as T;
}

export interface RevenueLine {
  provider: string;
  currency: string;
  amount_minor: number;
  payments: number;
}

export interface Overview {
  users_total: number;
  users_new: number;
  users_by_cycle: Record<string, number>;
  users_by_tutor_language: Record<string, number>;
  trials_active: number;
  trials_started: number;
  trials_ended: number;
  trials_converted: number;
  never_imported: number;
  subscribers_active: number;
  revenue: RevenueLine[];
  documents_imported: number;
  documents_failed: number;
  documents_pending: number;
  syntheses: number;
  quizzes: number;
  quiz_attempts: number;
  quiz_average: number | null;
  tutor_messages: number;
  calls: number;
  call_minutes: number;
  contestations: number;
  help_questions: number;
  help_helpful: number;
  help_not_helpful: number;
  support_open: number;
  ai_calls: number;
  ai_input_tokens: number;
  ai_output_tokens: number;
}

export function getOverview(days: number): Promise<Overview> {
  return rpc<Overview>("admin_overview", { p_days: days });
}

export interface DailyActivity {
  day: string;
  signups: number;
  documents: number;
  quizzes: number;
  tutor_messages: number;
  call_minutes: number;
}

export function getDailyActivity(days: number): Promise<DailyActivity[]> {
  return rpc<DailyActivity[]>("admin_daily", { p_days: days });
}

export interface AiUsageLine {
  feature: string;
  model: string;
  calls: number;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
}

export function getAiUsage(days: number): Promise<AiUsageLine[]> {
  return rpc<AiUsageLine[]>("admin_ai_usage", { p_days: days });
}

export type TrialState = "jamais" | "en_cours" | "termine";

export interface AdminUser {
  user_id: string;
  username: string;
  country_code: string;
  cycle: string;
  level_label: string | null;
  contact: string | null;
  created_at: string;
  plan_code: string | null;
  plan_label: string | null;
  plan_kind: "essai" | "abonnement" | null;
  access_end: string | null;
  trial_state: TrialState;
  documents: number;
  quizzes: number;
  tutor_messages: number;
  last_activity: string | null;
  is_admin: boolean;
}

export function listUsers(search: string): Promise<AdminUser[]> {
  return rpc<AdminUser[]>("admin_users", { p_search: search || null, p_limit: 100 });
}

export type SubscriptionStatus = "active" | "expired" | "cancelled";

export interface AdminSubscription {
  id: string;
  user_id: string;
  username: string | null;
  plan_code: string;
  plan_label: string | null;
  status: SubscriptionStatus;
  amount_minor: number;
  currency: string;
  payment_provider: string;
  payment_reference: string;
  starts_at: string;
  ends_at: string;
  created_at: string;
}

export function listSubscriptions(userId?: string): Promise<AdminSubscription[]> {
  return rpc<AdminSubscription[]>("admin_subscriptions", { p_user: userId ?? null, p_limit: 50 });
}

export interface AdminPlan {
  code: string;
  country_code: string;
  kind: "essai" | "abonnement";
  label: string;
  price_minor: number;
  currency: string;
  duration_days: number;
  quiz_limit: number | null;
  document_limit: number | null;
  tutor_message_limit: number | null;
  quiz_question_limit: number | null;
  call_minutes_limit: number | null;
  is_active: boolean;
  subscribers: number;
}

export function listPlans(): Promise<AdminPlan[]> {
  return rpc<AdminPlan[]>("admin_plans");
}

export type SupportStatus = "nouvelle" | "traitee";

export interface AdminSupportRequest {
  id: number;
  user_id: string;
  username: string | null;
  contact: string | null;
  message: string;
  status: SupportStatus;
  notified_email_at: string | null;
  notified_whatsapp_at: string | null;
  created_at: string;
}

export function listSupportRequests(status: SupportStatus | null): Promise<AdminSupportRequest[]> {
  return rpc<AdminSupportRequest[]>("admin_support_requests", { p_status: status, p_limit: 100 });
}

export interface JournalEntry {
  id: number;
  created_at: string;
  admin_username: string | null;
  action: string;
  target_username: string | null;
  details: Record<string, unknown>;
}

export function getJournal(): Promise<JournalEntry[]> {
  return rpc<JournalEntry[]>("admin_journal", { p_limit: 100 });
}

export interface AdminPaymentRequest {
  id: string;
  user_id: string;
  username: string | null;
  contact: string | null;
  plan_code: string;
  plan_label: string | null;
  price_minor: number;
  currency: string;
  provider: string;
  reference: string;
  status: "en_attente" | "validee" | "refusee";
  handled_at: string | null;
  created_at: string;
}

export function listPendingPayments(): Promise<AdminPaymentRequest[]> {
  return rpc<AdminPaymentRequest[]>("admin_payment_requests", { p_status: "en_attente", p_limit: 100 });
}
