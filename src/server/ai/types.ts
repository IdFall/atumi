/**
 * Interface interne vers le fournisseur de modèles.
 * Le produit ne dépend que de ces types : changer de fournisseur ne touche
 * que l'implémentation (voir anthropic.ts).
 */

export type AiFeature = "tutor" | "synthesis" | "quiz_generation" | "quiz_grading" | "document_structuring";

export type AiTier = "standard" | "light";

export interface AiMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AiRequest {
  feature: AiFeature;
  tier: AiTier;
  /** Consignes stables (mises en cache par le fournisseur). */
  system: string;
  messages: AiMessage[];
  maxTokens?: number;
}

export interface AiUsage {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
}

export type AiResult =
  | { status: "ok"; text: string; usage: AiUsage }
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
