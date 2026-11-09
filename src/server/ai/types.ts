/**
 * Interface interne vers le fournisseur de modèles.
 * Le produit ne dépend que de ces types : changer de fournisseur ne touche
 * que l'implémentation (voir anthropic.ts).
 */

export type AiFeature = "tutor" | "help" | "synthesis" | "quiz_generation" | "quiz_grading" | "document_structuring" | "image_reading" | "research";

export type AiTier = "standard" | "light";

/** Morceau d'un message : du texte, ou une image (photo de cours) encodée en base64. */
export type AiContentPart =
  | { type: "text"; text: string }
  | { type: "image"; mediaType: "image/jpeg" | "image/png" | "image/webp"; base64: string };

export interface AiMessage {
  role: "user" | "assistant";
  content: string | AiContentPart[];
}

export interface AiRequest {
  feature: AiFeature;
  tier: AiTier;
  /** Consignes stables (mises en cache par le fournisseur). */
  system: string;
  messages: AiMessage[];
  maxTokens?: number;
  /** Recherche sur le web par le fournisseur (sources citées dans `sources`). */
  webSearch?: { maxUses: number; country?: string };
}

/** Page web citée par une réponse. */
export interface AiSource {
  url: string;
  title: string;
}

export interface AiUsage {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  /** Recherches web faites pendant la requête (facturées à part). */
  webSearches?: number;
}

export type AiResult =
  | { status: "ok"; text: string; usage: AiUsage; sources?: AiSource[] }
  | { status: "refused"; usage: AiUsage }
  | { status: "unavailable"; reason: string };

export interface AiProvider {
  complete(request: AiRequest): Promise<AiResult>;
}

/** Passage d'un document de l'apprenant, transmis au modèle comme donnée. */
export interface SourcePassage {
  chunkId: number;
  documentTitle: string;
  page: number | null;
  content: string;
}
