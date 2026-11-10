import { createUserClient } from "@/lib/supabase/server";

/** Une jauge du forfait : ce qui reste sur ce qui est permis (null = sans limite). */
export interface Gauge {
  left: number | null;
  limit: number | null;
}

export interface DashboardStats {
  /** Forfait ou essai en cours. */
  hasAccess: boolean;
  messages: Gauge;
  imports: Gauge;
  research: Gauge;
  /** En minutes. */
  callMinutes: Gauge;
  quizzesDone: number;
  /** Moyenne des quiz passés, de 0 à 1 ; null sans quiz. */
  averageScore: number | null;
}

function gauge(used: number | null | undefined, limit: number | null | undefined): Gauge {
  if (limit === null || limit === undefined) return { left: null, limit: null };
  return { left: Math.max(0, limit - (used ?? 0)), limit };
}

/** Chiffres de l'accueil : jauges du forfait et progression, lus avec les droits de l'élève. */
export async function getDashboardStats(): Promise<DashboardStats> {
  const supabase = await createUserClient();
  const [usage, research, call, attempts] = await Promise.all([
    supabase.rpc("plan_usage"),
    supabase.rpc("research_quota"),
    supabase.rpc("call_quota"),
    supabase.from("quiz_attempts").select("score").not("submitted_at", "is", null),
  ]);
  const u = (usage.data as { documents_used: number; document_limit: number | null; tutor_messages_used: number; tutor_message_limit: number | null }[] | null)?.[0];
  const r = (research.data as { daily_limit: number | null; remaining: number | null }[] | null)?.[0];
  const c = (call.data as { minutes_limit: number | null; seconds_remaining: number | null }[] | null)?.[0];
  const scores = (attempts.data ?? []).map((a) => Number(a.score)).filter((s) => Number.isFinite(s));

  return {
    hasAccess: Boolean(u),
    messages: u ? gauge(u.tutor_messages_used, u.tutor_message_limit) : { left: 0, limit: 0 },
    imports: u ? gauge(u.documents_used, u.document_limit) : { left: 0, limit: 0 },
    research: r ? (r.daily_limit === null ? { left: null, limit: null } : { left: r.remaining ?? 0, limit: r.daily_limit }) : { left: 0, limit: 0 },
    callMinutes: c
      ? c.minutes_limit === null
        ? { left: null, limit: null }
        : { left: Math.floor((c.seconds_remaining ?? 0) / 60), limit: c.minutes_limit }
      : { left: 0, limit: 0 },
    quizzesDone: scores.length,
    averageScore: scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null,
  };
}
