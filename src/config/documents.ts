/** Formats acceptés à l'import (V1 : PDF et Word, pas de photos). Partagé navigateur et serveur. */
export const PDF_MIME = "application/pdf";
export const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export const ACCEPTED_MIME_TYPES = [PDF_MIME, DOCX_MIME] as const;
export type AcceptedMimeType = (typeof ACCEPTED_MIME_TYPES)[number];

/** Taille maximale d'un document importé (doit correspondre au bucket « documents »). */
export const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;

/** Contrôle côté navigateur avant l'envoi, repris côté serveur. */
export function checkFile(file: { type: string; size: number; name: string }): "fileType" | "fileRequired" | "fileTooLarge" | null {
  if (!resolveMime(file)) return "fileType";
  if (file.size <= 0) return "fileRequired";
  if (file.size > MAX_DOCUMENT_BYTES) return "fileTooLarge";
  return null;
}

/** Type retenu pour le fichier, ou null s'il n'est pas accepté. */
export function resolveMime(file: { type: string; name: string }): AcceptedMimeType | null {
  if ((ACCEPTED_MIME_TYPES as readonly string[]).includes(file.type)) return file.type as AcceptedMimeType;
  const fromName = mimeFromName(file.name);
  return fromName === "" ? null : fromName;
}

/** Certains téléphones n'indiquent pas le type du fichier : on le déduit de l'extension. */
export function mimeFromName(name: string): AcceptedMimeType | "" {
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf")) return PDF_MIME;
  if (lower.endsWith(".docx")) return DOCX_MIME;
  return "";
}
