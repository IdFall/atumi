import "server-only";

import { serverEnv } from "@/lib/env";

import { createAiProvider } from "./anthropic";
import type { AiProvider } from "./types";

let provider: AiProvider | undefined;

/** Fournisseur IA de l'application web. Sans clé d'API, le professeur se dit indisponible. */
export function getAiProvider(): AiProvider {
  if (provider) return provider;
  const env = serverEnv();
  provider = createAiProvider(env.ANTHROPIC_API_KEY, {
    standard: env.ATUMI_AI_MODEL,
    light: env.ATUMI_AI_MODEL_LIGHT,
  });
  return provider;
}
