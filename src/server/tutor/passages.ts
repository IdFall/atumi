import "server-only";

import type { SourcePassage } from "@/server/ai/types";
import type { TutorMode } from "@/server/ai/prompts";
import type { createUserClient } from "@/lib/supabase/server";

import { buildSearchQuery } from "./search";

type UserClient = Awaited<ReturnType<typeof createUserClient>>;

/** Plafond de texte du cours envoyé au professeur pour une réponse. */
const MAX_CHARS = { search: 12_000, chapter: 40_000 } as const;

/**
 * Passages du cours de l'apprenant pour répondre (client utilisateur : RLS).
 * « approfondir » reprend le chapitre dans l'ordre ; les autres modes cherchent
 * les passages proches de la question.
 */
export async function findPassages(
  supabase: UserClient,
  scope: { mode: TutorMode; moduleId: string | null; chapterId: string | null; question: string },
): Promise<SourcePassage[]> {
  if (scope.mode === "approfondir" && scope.chapterId) {
    const { data } = await supabase
      .from("document_chunks")
      .select("id, page, content, documents!inner(title, status)")
      .eq("chapter_id", scope.chapterId)
      .eq("documents.status", "ready")
      .order("id")
      .limit(80);
    return capped(
      (data ?? []).map((c) => ({
        chunkId: c.id,
        documentTitle: (c.documents as unknown as { title: string }).title,
        page: c.page,
        content: c.content,
      })),
      MAX_CHARS.chapter,
    );
  }

  const query = buildSearchQuery(scope.question);
  if (!query) return [];
  const { data: hits } = await supabase.rpc("search_document_chunks", {
    query,
    match_count: 8,
    filter_chapter_id: scope.chapterId,
  });
  const rows = (hits ?? []) as { id: number; document_id: string; page: number | null; content: string }[];
  if (rows.length === 0) return [];

  const { data: docs } = await supabase
    .from("documents")
    .select("id, title, module_id")
    .in("id", [...new Set(rows.map((r) => r.document_id))]);
  const byId = new Map((docs ?? []).map((d) => [d.id, d]));
  return capped(
    rows
      .filter((r) => !scope.moduleId || byId.get(r.document_id)?.module_id === scope.moduleId)
      .map((r) => ({ chunkId: r.id, documentTitle: byId.get(r.document_id)?.title ?? "", page: r.page, content: r.content })),
    MAX_CHARS.search,
  );
}

function capped(passages: SourcePassage[], maxChars: number): SourcePassage[] {
  const out: SourcePassage[] = [];
  let total = 0;
  for (const p of passages) {
    if (total + p.content.length > maxChars) break;
    out.push(p);
    total += p.content.length;
  }
  return out;
}
