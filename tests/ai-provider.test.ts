import { describe, expect, it } from "vitest";

import { AnthropicProvider, createAiProvider } from "../src/server/ai/anthropic";

const models = { standard: "modele-standard", light: "modele-leger" };

describe("createAiProvider", () => {
  it("se replie sur « indisponible » sans clé d'API, sans lever d'erreur", async () => {
    const provider = createAiProvider(undefined, models);
    const result = await provider.complete({
      feature: "help",
      tier: "light",
      system: "consignes",
      messages: [{ role: "user", content: "question" }],
      maxTokens: 10,
    });
    expect(result).toEqual({ status: "unavailable", reason: "missing_api_key" });
  });

  it("construit le fournisseur Claude quand une clé est fournie", () => {
    expect(createAiProvider("sk-ant-test", models)).toBeInstanceOf(AnthropicProvider);
  });
});
