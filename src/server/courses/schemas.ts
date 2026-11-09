import { z } from "zod";

import type { CoursesErrorKey, ImportErrorKey } from "@/i18n/messages";
import { ACCEPTED_MIME_TYPES, EXTENSION_BY_MIME, isImageMime, MAX_DOCUMENT_BYTES, MAX_IMAGE_BYTES } from "@/config/documents";

export { EXTENSION_BY_MIME };

export const DOCUMENT_KINDS = ["cours", "examen", "devoir", "exercice"] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

/** Choix proposés à l'import (les exercices viendront avec le mode S'exercer). */
export const IMPORT_KINDS = ["cours", "examen", "devoir"] as const satisfies readonly DocumentKind[];

const moduleName = z.string().trim().min(1).max(120);
const chapterTitle = z.string().trim().min(1).max(200);

export function parseModuleName(value: unknown): { ok: true; name: string } | { ok: false; error: CoursesErrorKey } {
  const parsed = moduleName.safeParse(value);
  return parsed.success ? { ok: true, name: parsed.data } : { ok: false, error: "nameRequired" };
}

export function parseChapterTitle(value: unknown): { ok: true; title: string } | { ok: false; error: CoursesErrorKey } {
  const parsed = chapterTitle.safeParse(value);
  return parsed.success ? { ok: true, title: parsed.data } : { ok: false, error: "titleRequired" };
}

/** Le fichier est rangé dans le dossier de l'utilisateur, sous un nom aléatoire. */
export function storagePathPattern(userId: string): RegExp {
  return new RegExp(`^${userId}/[0-9a-f-]{36}\\.(pdf|docx|jpg|png|webp)$`);
}

export interface ImportInput {
  module: { id: string } | { name: string };
  chapter: { id: string } | { title: string } | null;
  kind: DocumentKind;
  title: string;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
}

const importSchema = z.object({
  moduleId: z.string(),
  newModuleName: z.string(),
  chapterId: z.string(),
  newChapterTitle: z.string(),
  kind: z.enum(IMPORT_KINDS),
  fileName: z.string().trim().min(1).max(255),
  storagePath: z.string(),
  mimeType: z.enum(ACCEPTED_MIME_TYPES),
  sizeBytes: z.coerce.number().int().positive().max(MAX_DOCUMENT_BYTES),
});

export const NEW = "nouveau";

export function parseImport(
  raw: Record<string, unknown>,
  userId: string,
): { ok: true; data: ImportInput } | { ok: false; error: ImportErrorKey } {
  const parsed = importSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "unknown" };
  const v = parsed.data;

  if (!storagePathPattern(userId).test(v.storagePath)) return { ok: false, error: "unknown" };
  if (!v.storagePath.endsWith(`.${EXTENSION_BY_MIME[v.mimeType]}`)) return { ok: false, error: "fileType" };
  if (isImageMime(v.mimeType) && v.sizeBytes > MAX_IMAGE_BYTES) return { ok: false, error: "imageTooLarge" };

  let target: ImportInput["module"];
  if (v.moduleId === NEW) {
    const name = moduleName.safeParse(v.newModuleName);
    if (!name.success) return { ok: false, error: "moduleRequired" };
    target = { name: name.data };
  } else if (z.uuid().safeParse(v.moduleId).success) {
    target = { id: v.moduleId };
  } else {
    return { ok: false, error: "moduleRequired" };
  }

  let chapter: ImportInput["chapter"] = null;
  if (v.chapterId === NEW) {
    const title = chapterTitle.safeParse(v.newChapterTitle);
    if (!title.success) return { ok: false, error: "chapterTitleRequired" };
    chapter = { title: title.data };
  } else if (v.chapterId !== "") {
    if (!z.uuid().safeParse(v.chapterId).success || "name" in target) return { ok: false, error: "unknown" };
    chapter = { id: v.chapterId };
  }

  const title = v.fileName.replace(/\.(pdf|docx|jpe?g|png|webp)$/i, "").slice(0, 200) || v.fileName;
  return {
    ok: true,
    data: { module: target, chapter, kind: v.kind, title, storagePath: v.storagePath, mimeType: v.mimeType, sizeBytes: v.sizeBytes },
  };
}
