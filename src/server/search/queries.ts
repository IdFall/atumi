import "server-only";

import { containsPattern } from "@/lib/search";
import { createUserClient } from "@/lib/supabase/server";

import type { SearchResults } from "./types";

export type { SearchResults };

/**
 * Recherche dans les données de l'élève connecté (client utilisateur : RLS).
 * Noms de modules, chapitres, documents et échéances par « contient » ;
 * contenu des cours par recherche plein texte (`search_document_chunks`).
 * Aucun appel au modèle : la recherche ne compte pas dans le forfait.
 */

const LIMIT = 8;

function nameOf(linked: unknown): string | null {
  const row = Array.isArray(linked) ? linked[0] : linked;
  return row && typeof row === "object" && "name" in row && typeof row.name === "string" ? row.name : null;
}

export async function searchCourses(q: string): Promise<SearchResults> {
  const supabase = await createUserClient();
  const pattern = containsPattern(q);

  const [modules, chapters, documents, chunks, events] = await Promise.all([
    supabase.from("modules").select("id, name").ilike("name", pattern).order("name").limit(LIMIT),
    supabase.from("chapters").select("id, title, module_id, modules(name)").ilike("title", pattern).order("title").limit(LIMIT),
    supabase.from("documents").select("id, title, module_id").ilike("title", pattern).order("title").limit(LIMIT),
    supabase.rpc("search_document_chunks", { query: q, match_count: LIMIT }),
    supabase.from("agenda_events").select("id, title, due_on").or(`title.ilike.${JSON.stringify(pattern)},note.ilike.${JSON.stringify(pattern)}`).order("due_on").limit(LIMIT),
  ]);
  for (const r of [modules, chapters, documents, chunks]) if (r.error) throw r.error;

  // Titre et module des documents où un passage a été trouvé.
  const chunkRows = (chunks.data ?? []) as { id: number; document_id: string; page: number | null; content: string }[];
  const ids = [...new Set(chunkRows.map((c) => c.document_id))];
  const owners = ids.length
    ? await supabase.from("documents").select("id, title, module_id").in("id", ids)
    : { data: [] as { id: string; title: string; module_id: string }[], error: null };
  if (owners.error) throw owners.error;
  const byId = new Map((owners.data ?? []).map((d) => [d.id, d]));

  return {
    modules: modules.data ?? [],
    chapters: (chapters.data ?? []).map((c) => ({ id: c.id, title: c.title, moduleId: c.module_id, moduleName: nameOf(c.modules) })),
    documents: (documents.data ?? []).map((d) => ({ id: d.id, title: d.title, moduleId: d.module_id })),
    passages: chunkRows.flatMap((c) => {
      const doc = byId.get(c.document_id);
      return doc ? [{ id: c.id, documentId: doc.id, documentTitle: doc.title, moduleId: doc.module_id, page: c.page, content: c.content }] : [];
    }),
    // L'agenda est facultatif ici : une erreur (table absente, etc.) n'empêche pas la recherche.
    events: events.error ? [] : (events.data ?? []).map((e) => ({ id: e.id, title: e.title, dueOn: e.due_on })),
  };
}
