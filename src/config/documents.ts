/**
 * Formats acceptés à l'import : PDF, Word et photos de cours (JPG, PNG, WebP).
 * Partagé navigateur et serveur.
 */
export const PDF_MIME = "application/pdf";
export const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export const JPEG_MIME = "image/jpeg";
export const PNG_MIME = "image/png";
export const WEBP_MIME = "image/webp";

export const IMAGE_MIME_TYPES = [JPEG_MIME, PNG_MIME, WEBP_MIME] as const;
export const ACCEPTED_MIME_TYPES = [PDF_MIME, DOCX_MIME, ...IMAGE_MIME_TYPES] as const;
export type AcceptedMimeType = (typeof ACCEPTED_MIME_TYPES)[number];
export type ImageMimeType = (typeof IMAGE_MIME_TYPES)[number];

/** Taille maximale d'un document importé (doit correspondre au bucket « documents »). */
export const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;

/**
 * Taille maximale d'une photo, après réduction dans le navigateur.
 * Le modèle n'accepte pas d'image plus lourde.
 */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Extension du fichier rangé dans le bucket, selon son type. */
export const EXTENSION_BY_MIME: Record<AcceptedMimeType, "pdf" | "docx" | "jpg" | "png" | "webp"> = {
  [PDF_MIME]: "pdf",
  [DOCX_MIME]: "docx",
  [JPEG_MIME]: "jpg",
  [PNG_MIME]: "png",
  [WEBP_MIME]: "webp",
};

export function isImageMime(mimeType: string): mimeType is ImageMimeType {
  return (IMAGE_MIME_TYPES as readonly string[]).includes(mimeType);
}

/** Contrôle côté navigateur avant l'envoi, repris côté serveur. */
export function checkFile(file: { type: string; size: number; name: string }): "fileType" | "fileRequired" | "fileTooLarge" | "imageTooLarge" | null {
  const mime = resolveMime(file);
  if (!mime) return "fileType";
  if (file.size <= 0) return "fileRequired";
  if (file.size > MAX_DOCUMENT_BYTES) return "fileTooLarge";
  if (isImageMime(mime) && file.size > MAX_IMAGE_BYTES) return "imageTooLarge";
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
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return JPEG_MIME;
  if (lower.endsWith(".png")) return PNG_MIME;
  if (lower.endsWith(".webp")) return WEBP_MIME;
  return "";
}

/** Catégories de « Mes fichiers » (page Mes cours), dans l'ordre d'affichage. */
export const FILE_CATEGORIES = ["pdf", "word", "image"] as const;
export type FileCategory = (typeof FILE_CATEGORIES)[number];

/** Catégorie d'un fichier importé selon son type. */
export function fileCategory(mimeType: string): FileCategory {
  if ((IMAGE_MIME_TYPES as readonly string[]).includes(mimeType)) return "image";
  if (mimeType === DOCX_MIME) return "word";
  return "pdf";
}
