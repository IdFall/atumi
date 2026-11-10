import { describe, expect, it } from "vitest";

import { needsSharePage, readMoreMessage, shareExcerpt, sharePath, WHATSAPP_MAX_CHARS } from "@/lib/share-text";

describe("partage d'un long texte", () => {
  it("envoie le texte entier s'il tient dans un lien WhatsApp", () => {
    expect(needsSharePage("a".repeat(WHATSAPP_MAX_CHARS))).toBe(false);
    expect(needsSharePage("a".repeat(WHATSAPP_MAX_CHARS + 1))).toBe(true);
  });

  it("coupe le début sur un espace et ajoute « Lire la suite »", () => {
    const text = "mot ".repeat(1000);
    const excerpt = shareExcerpt(text, 100);
    expect(excerpt.length).toBeLessThanOrEqual(101);
    expect(excerpt.endsWith("mot…")).toBe(true);
    expect(shareExcerpt("court", 100)).toBe("court");
    expect(readMoreMessage(text, "Lire la suite sur ATUMI", "https://x.sn/partage/1")).toMatch(/…\n\nLire la suite sur ATUMI 👉 https:\/\/x\.sn\/partage\/1$/);
    expect(sharePath("abc")).toBe("/partage/abc");
  });
});
