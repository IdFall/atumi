import { describe, expect, it } from "vitest";

import { AnthropicProvider, createAiProvider, toAnthropicMessage } from "../src/server/ai/anthropic";

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

describe("toAnthropicMessage", () => {
  it("garde un message texte tel quel et traduit une image en bloc base64", () => {
    expect(toAnthropicMessage({ role: "user", content: "bonjour" })).toEqual({ role: "user", content: "bonjour" });
    expect(
      toAnthropicMessage({
        role: "user",
        content: [
          { type: "image", mediaType: "image/png", base64: "AAAA" },
          { type: "text", text: "Voici la photo à lire." },
        ],
      }),
    ).toEqual({
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: "image/png", data: "AAAA" } },
        { type: "text", text: "Voici la photo à lire." },
      ],
    });
  });
});

describe("AnthropicProvider : requête refusée", () => {
  it("renvoie « indisponible » au lieu de lever une erreur sur un refus 4xx", async () => {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const refusal = Anthropic.APIError.generate(400, { type: "error", error: { type: "invalid_request_error", message: "outil non activé" } }, "outil non activé", new Headers());
    const client = { beta: { messages: { create: async () => { throw refusal; } } } } as unknown as InstanceType<typeof Anthropic>;
    const provider = new AnthropicProvider({ models, client });
    const original = console.error;
    console.error = () => {};
    try {
      const result = await provider.complete({
        feature: "research",
        tier: "standard",
        system: "consignes",
        messages: [{ role: "user", content: "question" }],
        webSearch: { maxUses: 3 },
      });
      expect(result).toEqual({ status: "unavailable", reason: "request_400" });
    } finally {
      console.error = original;
    }
  });
});
