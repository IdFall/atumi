import "server-only";

import { serverEnv } from "@/lib/env";

import { AnthropicProvider } from "./anthropic";
import type { AiProvider } from "./types";

let provider: AiProvider | undefined;

/** Fournisseur IA de l'application web. Sans clé d'API, le professeur se dit indisponible. */
export function getAiProvider(): AiProvider {
  if (provider) return provider;
  const env = serverEnv();
  provider = env.ANTHROPIC_API_KEY
    ? new AnthropicProvider({ models: { standard: env.ATUMI_AI_MODEL, light: env.ATUMI_AI_MODEL_LIGHT } })
    : { complete: async () => ({ status: "unavailable", reason: "missing_api_key" }) };
  return provider;
}
