import "server-only";

import { createUserClient } from "@/lib/supabase/server";
import type { AiSource } from "@/server/ai/types";

/** Historique et limite de la recherche web de l'élève connecté (client utilisateur : RLS). */

export interface ResearchItem {
  id: number;
  question: string;
  answer: string | null;
  sources: AiSource[];
  createdAt: string;
}

export interface ResearchQuota {
  /** null = sans limite. */
  limit: number | null;
  remaining: number | null;
  hasAccess: boolean;
}

function sourcesOf(value: unknown): AiSource[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((s) =>
    s && typeof s === "object" && typeof s.url === "string" && /^https?:\/\//.test(s.url)
      ? [{ url: s.url, title: typeof s.title === "string" && s.title ? s.title : s.url }]
      : [],
  );
}

export async function listResearch(limit = 10): Promise<ResearchItem[]> {
  const supabase = await createUserClient();
  const { data, error } = await supabase
    .from("research_questions")
    .select("id, question, answer, sources, created_at")
    .not("answer", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []).map((r) => ({ id: r.id, question: r.question, answer: r.answer, sources: sourcesOf(r.sources), createdAt: r.created_at }));
}

export async function getResearchQuota(): Promise<ResearchQuota> {
  const supabase = await createUserClient();
  const { data, error } = await supabase.rpc("research_quota");
  const row = !error && Array.isArray(data) ? (data[0] as { daily_limit: number | null; remaining: number | null } | undefined) : undefined;
  return row ? { limit: row.daily_limit, remaining: row.remaining, hasAccess: true } : { limit: null, remaining: null, hasAccess: false };
}
