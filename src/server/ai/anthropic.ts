import Anthropic from "@anthropic-ai/sdk";

import type { AiMessage, AiProvider, AiRequest, AiResult, AiSource, AiTier } from "./types";

/** Fournisseur de repli quand aucune clé d'API n'est configurée : l'IA se dit indisponible. */
export const unavailableProvider: AiProvider = {
  complete: async () => ({ status: "unavailable", reason: "missing_api_key" }),
};

/**
 * Construit le fournisseur Claude, ou le repli « indisponible » sans clé d'API
 * (le SDK refuse de se construire sans clé, ce qui arrêterait le worker).
 */
export function createAiProvider(apiKey: string | undefined, models: Record<AiTier, string>): AiProvider {
  return apiKey ? new AnthropicProvider({ models, apiKey }) : unavailableProvider;
}

export interface AnthropicProviderOptions {
  models: Record<AiTier, string>;
  /** Par défaut, le SDK lit ANTHROPIC_API_KEY dans l'environnement. */
  apiKey?: string;
  client?: Anthropic;
}

/**
 * Implémentation Claude de l'interface AiProvider.
 * - cache de prompt automatique sur les consignes stables ;
 * - repli serveur automatique si le modèle refuse une requête ;
 * - délai maximal et nouvelles tentatives limitées.
 */
export class AnthropicProvider implements AiProvider {
  private readonly client: Anthropic;
  private readonly models: Record<AiTier, string>;

  constructor(options: AnthropicProviderOptions) {
    this.client = options.client ?? new Anthropic({ apiKey: options.apiKey, timeout: 60_000, maxRetries: 2 });
    this.models = options.models;
  }

  async complete(request: AiRequest): Promise<AiResult> {
    const model = this.models[request.tier];
    const messages: Anthropic.Beta.BetaMessageParam[] = request.messages.map(toAnthropicMessage);
    const tools = request.webSearch ? [webSearchTool(model, request.webSearch)] : undefined;
    const usage = { model, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, webSearches: 0 };
    const content: Anthropic.Beta.BetaContentBlock[] = [];
    try {
      // Avec la recherche web, le serveur peut mettre le tour en pause : on le relance (3 fois au plus).
      for (let round = 0; round < 3; round++) {
        const response = await this.client.beta.messages.create({
          model,
          max_tokens: request.maxTokens ?? 16000,
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
          cache_control: { type: "ephemeral" },
          output_config: { effort: request.tier === "light" ? "low" : "medium" },
          system: request.system,
          messages,
          ...(tools ? { tools } : {}),
        });

        usage.model = response.model;
        // Avec la mise en cache automatique, la plupart des jetons d'entrée d'un premier
        // appel sont comptés comme écriture en cache : on les ajoute à l'entrée (facturés
        // 1,25 fois le prix d'entrée), sinon la consommation journalisée serait sous-estimée.
        usage.inputTokens += response.usage.input_tokens + (response.usage.cache_creation_input_tokens ?? 0);
        usage.outputTokens += response.usage.output_tokens;
        usage.cacheReadTokens += response.usage.cache_read_input_tokens ?? 0;
        usage.webSearches += response.usage.server_tool_use?.web_search_requests ?? 0;
        content.push(...response.content);

        if (response.stop_reason === "refusal") {
          return { status: "refused", usage };
        }
        if (response.stop_reason !== "pause_turn") break;
        messages.push({ role: "assistant", content: response.content });
      }

      const text = content
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("");
      return request.webSearch ? { status: "ok", text, usage, sources: citedSources(content) } : { status: "ok", text, usage };
    } catch (error) {
      if (error instanceof Anthropic.RateLimitError) {
        return { status: "unavailable", reason: "rate_limited" };
      }
      if (error instanceof Anthropic.APIConnectionError) {
        return { status: "unavailable", reason: "connection" };
      }
      if (error instanceof Anthropic.APIError && (error.status ?? 0) >= 500) {
        return { status: "unavailable", reason: `upstream_${error.status}` };
      }
      if (error instanceof Anthropic.APIError && error.status) {
        // Requête refusée (clé, crédits, outil non activé…) : visible dans les journaux,
        // et l'élève reçoit le message « indisponible » au lieu d'une page d'erreur.
        console.error(`[ai] ${request.feature} refusé (${error.status}) : ${error.message}`);
        return { status: "unavailable", reason: `request_${error.status}` };
      }
      throw error;
    }
  }
}

/**
 * Outil de recherche web du fournisseur. La version avec filtrage dynamique
 * existe pour les modèles récents (Opus 4.6 et suivants, Sonnet 4.6 et suivants) ;
 * les autres gardent la version de base.
 */
export function webSearchTool(model: string, options: { maxUses: number; country?: string }): Anthropic.Beta.BetaToolUnion {
  const recent = /opus-(4-[6-9]|[5-9])|sonnet-(4-6|[5-9])|fable/.test(model);
  const userLocation = options.country ? { user_location: { type: "approximate" as const, country: options.country } } : {};
  return recent
    ? { type: "web_search_20260209", name: "web_search", max_uses: options.maxUses, ...userLocation }
    : { type: "web_search_20250305", name: "web_search", max_uses: options.maxUses, ...userLocation };
}

/** Pages citées dans la réponse, sans doublon, dans l'ordre d'apparition. */
export function citedSources(content: readonly Anthropic.Beta.BetaContentBlock[]): AiSource[] {
  const seen = new Map<string, AiSource>();
  for (const block of content) {
    if (block.type !== "text") continue;
    for (const citation of block.citations ?? []) {
      if (citation.type === "web_search_result_location" && !seen.has(citation.url)) {
        seen.set(citation.url, { url: citation.url, title: citation.title ?? citation.url });
      }
    }
  }
  return [...seen.values()];
}

/** Traduit un message interne au format de l'API (texte simple ou blocs texte et image). */
export function toAnthropicMessage(message: AiMessage): Anthropic.Beta.BetaMessageParam {
  if (typeof message.content === "string") return { role: message.role, content: message.content };
  return {
    role: message.role,
    content: message.content.map((part) =>
      part.type === "text"
        ? { type: "text" as const, text: part.text }
        : { type: "image" as const, source: { type: "base64" as const, media_type: part.mediaType, data: part.base64 } },
    ),
  };
}
