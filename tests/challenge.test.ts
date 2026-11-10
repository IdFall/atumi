import { describe, expect, it } from "vitest";

import { challengeOutcome, challengePath, cleanPlayerName, correctFromScore, isChallengeOpen, whatsappShareUrl } from "@/lib/challenge";

describe("défi quiz", () => {
  it("compare le score de l'ami à celui de l'élève", () => {
    expect(challengeOutcome(4, 3)).toBe("win");
    expect(challengeOutcome(3, 3)).toBe("draw");
    expect(challengeOutcome(2, 3)).toBe("lose");
  });

  it("retrouve les bonnes réponses depuis le score enregistré", () => {
    expect(correctFromScore("0.8000", 5)).toBe(4);
    expect(correctFromScore(0.6667, 3)).toBe(2);
    expect(correctFromScore(null, 5)).toBe(0);
    expect(correctFromScore(1.5, 5)).toBe(5);
    expect(correctFromScore(0.5, 0)).toBe(0);
  });

  it("construit le lien du défi et le lien WhatsApp", () => {
    expect(challengePath("abc")).toBe("/defi/abc");
    expect(whatsappShareUrl("8/10 👉 https://x.sn/defi/1")).toBe("https://wa.me/?text=8%2F10%20%F0%9F%91%89%20https%3A%2F%2Fx.sn%2Fdefi%2F1");
  });

  it("ferme le défi arrêté ou après ses 7 jours", () => {
    const now = Date.parse("2026-11-10T12:00:00Z");
    expect(isChallengeOpen({ closed_at: null, expires_at: "2026-11-17T12:00:00Z" }, now)).toBe(true);
    expect(isChallengeOpen({ closed_at: "2026-11-11T08:00:00Z", expires_at: "2026-11-17T12:00:00Z" }, now)).toBe(false);
    expect(isChallengeOpen({ closed_at: null, expires_at: "2026-11-10T11:59:00Z" }, now)).toBe(false);
  });

  it("nettoie le prénom de l'ami", () => {
    expect(cleanPlayerName("  Moussa   Diop ")).toBe("Moussa Diop");
    expect(cleanPlayerName("   ")).toBeNull();
    expect(cleanPlayerName("A".repeat(30))).toHaveLength(20);
  });
});
