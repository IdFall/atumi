import Anthropic from "@anthropic-ai/sdk";

import type { AiProvider, AiRequest, AiResult, AiTier } from "./types";

export interface AnthropicProviderOptions {
  models: Record<AiTier, string>;
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
    this.client = options.client ?? new Anthropic({ timeout: 60_000, maxRetries: 2 });
    this.models = options.models;
  }

  async complete(request: AiRequest): Promise<AiResult> {
    const model = this.models[request.tier];
    try {
      const response = await this.client.beta.messages.create({
        model,
        max_tokens: request.maxTokens ?? 16000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        cache_control: { type: "ephemeral" },
        output_config: { effort: request.tier === "light" ? "low" : "medium" },
        system: request.system,
        messages: request.messages,
      });

      const usage = {
        model: response.model,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
      };

      if (response.stop_reason === "refusal") {
        return { status: "refused", usage };
      }

      const text = response.content
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("");
      return { status: "ok", text, usage };
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
      throw error;
    }
  }
}
