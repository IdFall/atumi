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
