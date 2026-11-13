import "server-only";

import { nextStep, type NextStep } from "@/lib/next-step";
import { createUserClient } from "@/lib/supabase/server";

import { fileCategory, type FileCategory } from "@/config/documents";
import { downloadName } from "@/lib/document-view";

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

/** Durée de validité des liens vers le fichier (privé, dans le dossier de l'élève). */
const FILE_LINK_SECONDS = 15 * 60;

export interface DocumentFile {
  id: string;
  title: string;
  kind: DocumentKind;
  mimeType: string;
  moduleId: string;
  moduleName: string;
  /** Lien signé pour afficher le fichier dans ATUMI. */
  viewUrl: string;
  /** Lien signé qui enregistre le fichier sur l'appareil. */
  downloadUrl: string;
}

/**
 * Fichier d'un document importé, pour l'ouvrir dans ATUMI.
 * Le client utilisateur ne voit que ses documents (RLS) et ne peut signer que
 * les fichiers de son propre dossier (règle du bucket « documents »).
 */
export async function getDocumentFile(moduleId: string, documentId: string): Promise<DocumentFile | null> {
  const supabase = await createUserClient();
  const { data, error } = await supabase
    .from("documents")
    .select("id, title, kind, mime_type, storage_path, module_id, modules(name)")
    .eq("id", documentId)
    .eq("module_id", moduleId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const bucket = supabase.storage.from("documents");
  const [view, download] = await Promise.all([
    bucket.createSignedUrl(data.storage_path, FILE_LINK_SECONDS),
    bucket.createSignedUrl(data.storage_path, FILE_LINK_SECONDS, { download: downloadName(data.title, data.storage_path) }),
  ]);
  if (view.error || download.error) return null;

  const mod = Array.isArray(data.modules) ? data.modules[0] : data.modules;
  return {
    id: data.id,
    title: data.title,
    kind: data.kind as DocumentKind,
    mimeType: data.mime_type,
    moduleId: data.module_id,
    moduleName: mod?.name ?? "",
    viewUrl: view.data.signedUrl,
    downloadUrl: download.data.signedUrl,
  };
}

export type Access =
  | { state: "trialNotStarted" }
  | { state: "trial"; endsAt: string; minutesLeft: number }
  | { state: "subscribed"; endsAt: string }
  | { state: "expired" }
  /** Un parent a refusé l'inscription : plus aucun droit. */
  | { state: "suspended" };

export async function getAccess(): Promise<Access> {
  const supabase = await createUserClient();
  const [{ data, error }, { data: parental }] = await Promise.all([
    supabase.rpc("my_access").single<{
      plan_code: string | null;
      kind: string | null;
      period_end: string | null;
      trial_used: boolean;
    }>(),
    supabase.rpc("my_parental_status"),
  ]);
  if (error) throw error;
  if (parental === "refuse") return { state: "suspended" };
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

export interface CourseFile {
  id: string;
  title: string;
  moduleId: string;
  moduleName: string;
  chapterTitle: string | null;
  status: DocumentStatus;
  category: FileCategory;
}

/** Tous les fichiers importés, du plus récent au plus ancien, pour « Mes fichiers » (page Mes cours). */
export async function listMyFiles(): Promise<CourseFile[]> {
  const supabase = await createUserClient();
  const { data, error } = await supabase
    .from("documents")
    .select("id, title, mime_type, status, module_id, modules(name), chapters(title)")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data ?? []).map((d) => ({
    id: d.id,
    title: d.title,
    moduleId: d.module_id,
    moduleName: (d.modules as unknown as { name: string } | null)?.name ?? "",
    chapterTitle: (d.chapters as unknown as { title: string } | null)?.title ?? null,
    status: d.status as DocumentStatus,
    category: fileCategory(d.mime_type),
  }));
}
