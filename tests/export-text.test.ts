import { describe, expect, it } from "vitest";

import { toHtml, toPlainText } from "@/lib/export-text";

const md = "## Intégrales\n- **Primitive** de $\\frac{1}{x}$ : ln x [p. 5]\n- Aire sous la courbe\n\n## À retenir\nTexte <b>libre</b>";

describe("copie vers d'autres outils", () => {
  it("donne un texte lisible dans WhatsApp", () => {
    const text = toPlainText(md, "Intégrales · Synthèse");
    expect(text).toContain("INTÉGRALES");
    expect(text).toContain("• Primitive de (1)/(x) : ln x [p. 5]");
    expect(text).not.toContain("**");
    expect(text).not.toContain("$");
    expect(text.endsWith("— ATUMI")).toBe(true);
  });

  it("garde titres, gras et listes pour Word et Excel, sans HTML injecté", () => {
    const html = toHtml(md, "Synthèse");
    expect(html).toContain("<h1>Synthèse</h1><h2>Intégrales</h2><ul><li><strong>Primitive</strong>");
    expect(html).toContain("</ul><h2>À retenir</h2>");
    expect(html).toContain("&lt;b&gt;libre&lt;/b&gt;");
  });
});
