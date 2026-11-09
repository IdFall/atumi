/**
 * Lecture d'un document importé : extraction du texte (PDF, Word) ou lecture
 * d'une photo par le modèle, découpage en passages par page, enregistrement
 * pour la recherche. Une photo floue, coupée ou illisible est refusée avec un
 * message qui demande de la reprendre : ni synthèse ni quiz ne sont lancés. Les embeddings seront ajoutés
 * quand le modèle sera choisi ; la recherche plein texte fonctionne déjà.
 */
import { isImageMime } from "../config/documents";
import type { AiFeature, AiProvider, AiUsage } from "../server/ai/types";
import { chunkPages, type Chunk, type PageText } from "../server/documents/chunk";
import { extractPages, UnreadableDocumentError } from "../server/documents/extract";
import { readPhoto, type PhotoProblem } from "../server/documents/photo";

export interface IngestDocument {
  id: string;
  userId: string;
  chapterId: string | null;
  storagePath: string;
  mimeType: string;
  status: string;
}

export interface IngestStore {
  getDocument(userId: string, documentId: string): Promise<IngestDocument | null>;
  download(storagePath: string): Promise<Uint8Array>;
  markProcessing(doc: IngestDocument): Promise<void>;
  /** Remplace les passages du document (une relance ne crée pas de doublons). */
  replaceChunks(doc: IngestDocument, chunks: Chunk[]): Promise<void>;
  markReady(doc: IngestDocument, pageCount: number | null): Promise<void>;
  markFailed(doc: IngestDocument, reason: string): Promise<void>;
  logUsage(doc: IngestDocument, feature: AiFeature, usage: AiUsage): Promise<void>;
}

/** Messages stockés avec le document en échec, affichés à l'apprenant. */
export const FAILURE_REASONS = {
  empty: "Aucun texte lisible : le PDF est sans doute une image scannée. Exporte-le en PDF texte ou en Word, ou prends les pages en photo.",
  corrupted: "Le fichier est endommagé ou protégé par un mot de passe.",
  unsupported: "Format non pris en charge. Utilise un PDF, un fichier Word (.docx) ou une photo (JPG, PNG, WebP).",
} as const;

/** Photo refusée : le message dit quoi faire pour la reprendre. */
export const PHOTO_FAILURE_REASONS: Record<PhotoProblem, string> = {
  blurry: "La photo est floue. Reprends-la en tenant le téléphone immobile, bien au-dessus de la page, puis importe-la à nouveau.",
  cropped: "Une partie de la page est coupée ou cachée. Reprends la photo en cadrant la page entière, puis importe-la à nouveau.",
  dark: "La photo est trop sombre ou gênée par un reflet. Reprends-la avec plus de lumière, sans flash, puis importe-la à nouveau.",
  offTopic: "Cette photo ne montre pas de cours ou d'exercice lisible. Prends en photo ta page de cours, puis importe-la à nouveau.",
  noText: "ATUMI n'a pas trouvé assez de texte sur cette photo. Reprends-la en cadrant la page entière, nette et bien éclairée.",
  tooLarge: "Cette photo est trop lourde. Reprends-la ou envoie-la en taille réduite.",
  corrupted: "Cette photo est endommagée. Reprends-la, puis importe-la à nouveau.",
  refused: "ATUMI n'a pas pu lire cette photo. Reprends-la, ou importe ton cours en PDF ou en Word.",
  aiDisabled: "La lecture des photos n'est pas encore activée. Importe ton cours en PDF ou en Word.",
};

/** Panne passagère du service d'IA : pg-boss relancera la lecture. */
export class TemporaryIngestError extends Error {}

export async function ingestDocument(
  store: IngestStore,
  provider: AiProvider,
  userId: string,
  documentId: string,
): Promise<"ready" | "failed" | "skipped"> {
  const doc = await store.getDocument(userId, documentId);
  if (!doc || doc.status === "ready") return "skipped";

  await store.markProcessing(doc);
  try {
    const bytes = await store.download(doc.storagePath);
    let pages: PageText[];
    let pageCount: number | null;
    if (isImageMime(doc.mimeType)) {
      const photo = await readPhoto(provider, bytes);
      if (photo.status === "retry") throw new TemporaryIngestError(photo.reason);
      if (photo.usage) await store.logUsage(doc, "image_reading", photo.usage);
      if (photo.status === "rejected") {
        await store.markFailed(doc, PHOTO_FAILURE_REASONS[photo.problem]);
        return "failed";
      }
      ({ pages } = photo);
      pageCount = 1;
    } else {
      ({ pages, pageCount } = await extractPages(bytes, doc.mimeType));
    }
    const chunks = chunkPages(pages);
    if (chunks.length === 0) throw new UnreadableDocumentError("empty");
    await store.replaceChunks(doc, chunks);
    await store.markReady(doc, pageCount);
    return "ready";
  } catch (error) {
    if (error instanceof UnreadableDocumentError) {
      await store.markFailed(doc, FAILURE_REASONS[error.reason]);
      return "failed";
    }
    // Erreur passagère (réseau, base) : pg-boss relancera le travail.
    throw error;
  }
}
