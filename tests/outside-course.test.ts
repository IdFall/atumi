import { describe, expect, it } from "vitest";

import { canExploreFurther } from "@/lib/further";
import { conceptOf, extractOutsideMarker, isOutsideCitation, outsideLinks } from "@/lib/outside-course";
import { tutorSystemPrompt } from "@/server/ai/prompts";

describe("notion absente du cours", () => {
  it("tire le mot ou la notion de la question", () => {
    expect(conceptOf("C'est quoi la photosynthèse ?")).toBe("photosynthèse");
    expect(conceptOf("Explique-moi la mitose")).toBe("mitose");
    expect(conceptOf("explique moi ce qu'est un allèle stp")).toBe("allèle");
    expect(conceptOf("Qu'est-ce que l'entropie ?")).toBe("entropie");
    expect(conceptOf("Que veut dire « hégémonie » ?")).toBe("« hégémonie »");
    expect(conceptOf("Bonjour, peux-tu m'expliquer le théorème de Thalès ?")).toBe("théorème de Thalès");
    expect(conceptOf("What is an enzyme?")).toBe("enzyme");
    expect(conceptOf("Photosynthèse")).toBe("Photosynthèse");
    expect(conceptOf("?")).toBe("?");
    expect(conceptOf("x".repeat(100)).length).toBeLessThanOrEqual(61);
  });

  it("retire la ligne [hors-cours: …] écrite par le modèle", () => {
    expect(extractOutsideMarker("[hors-cours: photosynthèse]\nCe n'est pas dans ton cours.")).toEqual({
      text: "Ce n'est pas dans ton cours.",
      term: "photosynthèse",
    });
    expect(extractOutsideMarker("  [Hors cours : big bang]\n\nTexte")).toEqual({ text: "Texte", term: "big bang" });
    expect(extractOutsideMarker("## D'après ton cours\n[hors-cours: x]")).toEqual({ text: "## D'après ton cours\n[hors-cours: x]", term: null });
  });

  it("construit les liens qui lancent la recherche sans ressaisie", () => {
    const links = outsideLinks({ outsideTerm: "photosynthèse", question: "C'est quoi la photosynthèse ?" });
    expect(links.web).toBe("/recherche?onglet=web&lancer=C'est%20quoi%20la%20photosynth%C3%A8se%20%3F");
    expect(links.encyclopedia).toBe("/recherche?onglet=outils&encyclopedie=photosynth%C3%A8se");
    expect(isOutsideCitation({ outsideTerm: "a", question: "b" })).toBe(true);
    expect(isOutsideCitation({ page: 1, documentTitle: "x" })).toBe(false);
  });

  it("ne propose pas « Pour aller plus loin » sous une notion absente du cours", () => {
    const question = { role: "user", content: "C'est quoi le big bang ?", citations: [] };
    const outside = { role: "assistant", content: "Pas dans ton cours.", citations: [{ outsideTerm: "big bang", question: "C'est quoi le big bang ?" }] };
    expect(canExploreFurther("expliquer", [question, outside])).toBe(false);
  });

  it("demande au modèle d'annoncer la notion absente en mode Explication seulement", () => {
    expect(tutorSystemPrompt("expliquer", "lycee")).toContain("[hors-cours:");
    expect(tutorSystemPrompt("exercer", "lycee")).not.toContain("[hors-cours:");
    expect(tutorSystemPrompt("decouvrir", "lycee")).not.toContain("[hors-cours:");
  });
});
