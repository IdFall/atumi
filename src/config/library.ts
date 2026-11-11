/**
 * Ma bibliothèque : livres offerts par ATUMI et règles des ajouts.
 * Les livres offerts sont livrés avec l'application (dossier `content/bibliotheque`),
 * lisibles par tout élève qui a un accès (essai compris), téléchargeables par les abonnés.
 * L'espace de chaque abonné vient du forfait (`plans.library_bytes_limit`).
 */

export interface DefaultBook {
  /** Identifiant dans l'adresse (/bibliotheque/<id>). */
  id: string;
  title: string;
  author: string;
  pages: number;
  /** Fichier dans content/bibliotheque. */
  file: string;
}

export const DEFAULT_BOOKS: readonly DefaultBook[] = [
  {
    id: "guide-ia",
    title: "Guide IA pour l'Élève et l'Étudiant 2.0 : réussir ses études avec l'intelligence artificielle",
    author: "Idrissa Fall",
    pages: 24,
    file: "guide-ia-eleve-etudiant.pdf",
  },
];

export const LIBRARY_BUCKET = "bibliotheque";
export const LIBRARY_MIME = "application/pdf";
/** Taille maximale d'un fichier (comme le bucket) : 50 Mo. */
export const LIBRARY_MAX_FILE_BYTES = 50 * 1024 * 1024;

/**
 * Import d'un livre dans « Mes cours » (synthèse, quiz, Prof NEO) : limité en
 * pages, car un gros livre coûte cher à lire par le modèle. Au-delà, l'élève
 * importe plutôt un chapitre.
 */
export const LIBRARY_IMPORT_MAX_PAGES = 60;

/** Un livre peut-il être importé dans « Mes cours » ? (taille déjà vérifiée par le bucket des documents) */
export function bookImportError(sizeBytes: number, pages: number, maxDocumentBytes: number): "fileTooLarge" | "tooManyPages" | null {
  if (sizeBytes > maxDocumentBytes) return "fileTooLarge";
  if (pages > LIBRARY_IMPORT_MAX_PAGES) return "tooManyPages";
  return null;
}

export function defaultBook(id: string): DefaultBook | undefined {
  return DEFAULT_BOOKS.find((b) => b.id === id);
}

/** Taille lisible : « 3,2 Mo », « 850 Ko ». */
export function formatBytes(bytes: number, locale: string): string {
  const units = locale.startsWith("fr") ? ["o", "Ko", "Mo", "Go"] : ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  const digits = unit >= 2 && value < 10 ? 1 : 0;
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(value)} ${units[unit]}`;
}

/** Titre proposé à partir du nom du fichier. */
export function titleFromFileName(name: string): string {
  return name.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").trim().slice(0, 200) || "Document";
}

const UUID_PDF = /^[0-9a-f-]{36}\.pdf$/;

/** Chemin attendu dans le bucket : <utilisateur>/<uuid>.pdf, dans le dossier de l'élève. */
export function isOwnLibraryPath(path: string, userId: string): boolean {
  const [folder, name, ...rest] = path.split("/");
  return folder === userId && rest.length === 0 && typeof name === "string" && UUID_PDF.test(name);
}
