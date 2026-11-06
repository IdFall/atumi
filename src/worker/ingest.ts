/**
 * Lecture d'un document importé : extraction du texte, découpage en passages
 * par page, enregistrement pour la recherche. Les embeddings seront ajoutés
 * quand le modèle sera choisi ; la recherche plein texte fonctionne déjà.
 */
import { chunkPages, type Chunk } from "../server/documents/chunk";
import { extractPages, UnreadableDocumentError } from "../server/documents/extract";

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
}

/** Messages stockés avec le document en échec, affichés à l'apprenant. */
export const FAILURE_REASONS = {
  empty: "Aucun texte lisible : le PDF est sans doute une image scannée. Exporte-le en PDF texte ou en Word.",
  corrupted: "Le fichier est endommagé ou protégé par un mot de passe.",
  unsupported: "Format non pris en charge. Utilise un PDF ou un fichier Word (.docx).",
} as const;

export async function ingestDocument(store: IngestStore, userId: string, documentId: string): Promise<"ready" | "failed" | "skipped"> {
  const doc = await store.getDocument(userId, documentId);
  if (!doc || doc.status === "ready") return "skipped";

  await store.markProcessing(doc);
  try {
    const bytes = await store.download(doc.storagePath);
    const { pages, pageCount } = await extractPages(bytes, doc.mimeType);
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
