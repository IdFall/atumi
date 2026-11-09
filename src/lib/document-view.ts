/** Outils partagés (navigateur et serveur) pour ouvrir un document importé dans ATUMI. */

/** Façon d'afficher le fichier, déduite de son type. */
export type ViewerKind = "pdf" | "docx" | "image" | "other";

export function viewerKind(mimeType: string): ViewerKind {
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return "docx";
  if (mimeType.startsWith("image/")) return "image";
  return "other";
}

const FORBIDDEN_IN_NAME = /[\\/:*?"<>|\u0000-\u001f]+/g;

/** Nom proposé à l'enregistrement : le titre du document, avec l'extension du fichier. */
export function downloadName(title: string, storagePath: string): string {
  const dot = storagePath.lastIndexOf(".");
  const extension = dot >= 0 ? storagePath.slice(dot + 1).toLowerCase() : "";
  const base = title.replace(FORBIDDEN_IN_NAME, " ").replace(/\s+/g, " ").trim().slice(0, 100) || "document";
  if (!extension || base.toLowerCase().endsWith(`.${extension}`)) return base;
  return `${base}.${extension}`;
}

/** Seuls les liens web sont gardés dans un document Word affiché (pas de javascript:, data:…). */
export function isSafeLink(href: string): boolean {
  return /^https?:\/\//i.test(href.trim());
}

/** Seules les images intégrées au document Word (data:image/…) sont affichées. */
export function isSafeImageSource(src: string): boolean {
  return /^data:image\/(png|jpe?g|gif|webp|bmp);base64,/i.test(src.trim());
}
