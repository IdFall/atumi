"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createServiceClient } from "@/lib/supabase/server";
import { requireUserId } from "@/server/auth/session";

/**
 * Supprimer un quiz ou une synthèse (pages « Mes quiz » et « Mes synthèses »).
 * Ces tables ne sont écrites que par le serveur : la suppression passe par la
 * clé secrète, toujours filtrée sur l'élève connecté. Supprimer ne redonne rien
 * au forfait (`quizzes_keep_consumption`). Une préparation en cours n'est pas
 * supprimée : le worker est encore en train d'écrire.
 */

export interface DeleteState {
  error?: "busy" | "unknown";
}

/** Au-delà, une préparation bloquée est considérée comme abandonnée (même règle que la page Synthèse). */
const STALE_AFTER_MS = 15 * 60 * 1000;

const idOf = (formData: FormData) => z.uuid().safeParse(formData.get("id"));

function stillRunning(status: string, since: string): boolean {
  return status === "generating" && Date.now() - Date.parse(since) < STALE_AFTER_MS;
}

export async function deleteQuizAction(_prev: DeleteState, formData: FormData): Promise<DeleteState> {
  const userId = await requireUserId();
  const id = idOf(formData);
  if (!id.success) return { error: "unknown" };
  const service = createServiceClient();
  const { data: quiz } = await service.from("quizzes").select("id, status, created_at, module_id").eq("id", id.data).eq("user_id", userId).maybeSingle();
  if (!quiz) return { error: "unknown" };
  if (stillRunning(quiz.status, quiz.created_at)) return { error: "busy" };

  // Questions, tentatives, défis et réponses des amis partent avec le quiz (clés étrangères en cascade).
  const { error } = await service.from("quizzes").delete().eq("id", quiz.id).eq("user_id", userId);
  if (error) return { error: "unknown" };

  revalidatePath("/quiz");
  revalidatePath(`/cours/${quiz.module_id}/synthese`);
  revalidatePath("/tableau-de-bord");
  return {};
}

/** Supprime la synthèse d'un chapitre (ou du module), avec ses versions précédentes. */
export async function deleteSynthesisAction(_prev: DeleteState, formData: FormData): Promise<DeleteState> {
  const userId = await requireUserId();
  const id = idOf(formData);
  if (!id.success) return { error: "unknown" };
  const service = createServiceClient();
  const { data: synthesis } = await service
    .from("syntheses")
    .select("id, module_id, chapter_id")
    .eq("id", id.data)
    .eq("user_id", userId)
    .maybeSingle();
  if (!synthesis) return { error: "unknown" };

  let scope = service.from("syntheses").select("id, status, updated_at").eq("user_id", userId).eq("module_id", synthesis.module_id);
  scope = synthesis.chapter_id ? scope.eq("chapter_id", synthesis.chapter_id) : scope.is("chapter_id", null);
  const { data: versions, error: readError } = await scope;
  if (readError) return { error: "unknown" };
  if ((versions ?? []).some((v) => stillRunning(v.status, v.updated_at))) return { error: "busy" };

  const { error } = await service
    .from("syntheses")
    .delete()
    .eq("user_id", userId)
    .in("id", (versions ?? []).map((v) => v.id));
  if (error) return { error: "unknown" };

  revalidatePath("/syntheses");
  revalidatePath(`/cours/${synthesis.module_id}/synthese`);
  return {};
}
