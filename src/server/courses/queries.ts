import "server-only";

import { nextStep, type NextStep } from "@/lib/next-step";
import { createUserClient } from "@/lib/supabase/server";

import type { DocumentKind } from "./schemas";

/** Lectures des cours de l'utilisateur connecté (client utilisateur : RLS s'applique). */

export type DocumentStatus = "uploaded" | "processing" | "ready" | "failed";

export interface ModuleSummary {
  id: string;
  name: string;
  chapterCount: number;
  documentCount: number;
  chapters: { id: string; title: string }[];
  /** Ce que l'élève peut faire maintenant avec ce module (importer, attendre, réviser). */
  next: NextStep;
}

export async function listModules(): Promise<ModuleSummary[]> {
  const supabase = await createUserClient();
  const { data, error } = await supabase
    .from("modules")
    .select("id, name, created_at, chapters(id, title, position, created_at), documents(status, chapter_id)")
    .order("created_at", { ascending: false });
  if (error) throw error;

  return (data ?? []).map((m) => {
    const chapters = [...(m.chapters ?? [])].sort(byPosition);
    const documents = (m.documents ?? []).map((d) => ({ status: d.status as DocumentStatus, chapterId: d.chapter_id }));
    return {
      id: m.id,
      name: m.name,
      chapterCount: chapters.length,
      documentCount: documents.length,
      chapters: chapters.map((c) => ({ id: c.id, title: c.title })),
      next: nextStep(documents, chapters.map((c) => c.id)),
    };
  });
}

export interface ModuleDocument {
  id: string;
  title: string;
  kind: DocumentKind;
  status: DocumentStatus;
  pageCount: number | null;
  errorMessage: string | null;
  chapterId: string | null;
  moduleId: string;
}

export interface ModuleDetail {
  id: string;
  name: string;
  chapters: { id: string; title: string; documents: ModuleDocument[] }[];
  unassigned: ModuleDocument[];
}

export async function getModule(moduleId: string): Promise<ModuleDetail | null> {
  const supabase = await createUserClient();
  const { data, error } = await supabase
    .from("modules")
    .select(
      "id, name, chapters(id, title, position, created_at), documents(id, title, kind, status, page_count, error_message, chapter_id, created_at)",
    )
    .eq("id", moduleId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const documents: ModuleDocument[] = [...(data.documents ?? [])]
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((d) => ({
      id: d.id,
      title: d.title,
      kind: d.kind as DocumentKind,
      status: d.status as DocumentStatus,
      pageCount: d.page_count,
      errorMessage: d.error_message,
      chapterId: d.chapter_id,
      moduleId: data.id,
    }));

  return {
    id: data.id,
    name: data.name,
    chapters: [...(data.chapters ?? [])].sort(byPosition).map((c) => ({
      id: c.id,
      title: c.title,
      documents: documents.filter((d) => d.chapterId === c.id),
    })),
    unassigned: documents.filter((d) => d.chapterId === null),
  };
}

export type Access =
  | { state: "trialNotStarted" }
  | { state: "trial"; endsAt: string; minutesLeft: number }
  | { state: "subscribed"; endsAt: string }
  | { state: "expired" };

export async function getAccess(): Promise<Access> {
  const supabase = await createUserClient();
  const { data, error } = await supabase.rpc("my_access").single<{
    plan_code: string | null;
    kind: string | null;
    period_end: string | null;
    trial_used: boolean;
  }>();
  if (error) throw error;
  if (data.plan_code && data.period_end) {
    return data.kind === "essai"
      ? { state: "trial", endsAt: data.period_end, minutesLeft: minutesUntil(data.period_end) }
      : { state: "subscribed", endsAt: data.period_end };
  }
  return data.trial_used ? { state: "expired" } : { state: "trialNotStarted" };
}

function byPosition(a: { position: number; created_at: string }, b: { position: number; created_at: string }) {
  return a.position - b.position || a.created_at.localeCompare(b.created_at);
}

function minutesUntil(iso: string): number {
  return Math.max(0, Math.round((Date.parse(iso) - Date.now()) / 60_000));
}
