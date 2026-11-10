import { describe, expect, it } from "vitest";

import { isAllowedImage, parseBoard, parseInline, usesBoard } from "@/lib/board";
import { tutorSystemPrompt } from "@/server/ai/prompts";
import { resolveBoardImages } from "@/server/tutor/board-images";

const SAMPLE = `## La loi d'Ohm

La tension $U$ est proportionnelle à l'intensité $I$ [p. 3].

$$
U = R \\times I
$$

:::definition Résistance
Elle s'oppose au passage du courant.
- unité : l'ohm (Ω)
:::

\`\`\`schema
flowchart LR
  A["Générateur"] --> B["Résistance"]
\`\`\`

| Grandeur | Unité |
|---|---|
| U | V |
| I | A |

1. Mesurer U
2. Mesurer I

[image: ohm law circuit | Un circuit simple]`;

describe("tableau du Prof NEO", () => {
  it("découpe le Markdown en blocs", () => {
    const blocks = parseBoard(SAMPLE);
    expect(blocks.map((b) => b.kind)).toEqual(["heading", "paragraph", "math", "box", "schema", "table", "list", "image"]);
    expect(blocks[2]).toEqual({ kind: "math", tex: "U = R \\times I" });
    const box = blocks[3];
    expect(box.kind === "box" && box.box).toBe("definition");
    expect(box.kind === "box" && box.title).toBe("Résistance");
    expect(box.kind === "box" && box.blocks.map((b) => b.kind)).toEqual(["paragraph", "list"]);
    expect(blocks[5]).toEqual({ kind: "table", header: ["Grandeur", "Unité"], rows: [["U", "V"], ["I", "A"]] });
    expect(blocks[6]).toMatchObject({ kind: "list", ordered: true, items: ["Mesurer U", "Mesurer I"] });
    expect(usesBoard(blocks)).toBe(true);
  });

  it("garde une réponse simple hors du tableau", () => {
    expect(usesBoard(parseBoard("Bonne question ! **Oui**, c'est juste [p. 2].\n\n- un\n- deux"))).toBe(false);
  });

  it("lit formules, gras et renvois dans une ligne", () => {
    expect(parseInline("Si $x > 0$ alors **positif** [p. 4]")).toEqual([
      { kind: "text", text: "Si " },
      { kind: "math", tex: "x > 0" },
      { kind: "text", text: " alors " },
      { kind: "bold", text: "positif" },
      { kind: "text", text: " " },
      { kind: "ref", label: "p. 4" },
    ]);
  });

  it("n'affiche que les images de Wikimedia Commons", () => {
    expect(isAllowedImage("https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/x.png/800px-x.png")).toBe(true);
    expect(isAllowedImage("https://exemple.com/x.png")).toBe(false);
    expect(isAllowedImage("javascript:alert(1)")).toBe(false);
    expect(usesBoard(parseBoard("[image: https://exemple.com/x.png | piège]"))).toBe(false);
  });

  it("remplace les demandes d'image du modèle, ou les retire", async () => {
    const found = { src: "https://upload.wikimedia.org/wikipedia/commons/a.png", page: "https://commons.wikimedia.org/wiki/File:A.png" };
    const asked: string[] = [];
    const text = await resolveBoardImages(
      "Avant\n[image: heart anatomy | Le cœur]\n[image: https://upload.wikimedia.org/faux.png | inventée]\n[image: nothing | rien]\n[image: third | trop]\nAprès",
      async (q) => {
        asked.push(q);
        return q === "heart anatomy" ? found : null;
      },
    );
    expect(asked).toEqual(["heart anatomy", "nothing"]);
    expect(text).toBe(`Avant\n[image: ${found.src} | Le cœur | ${found.page}]\nAprès`);
  });

  it("donne les consignes du tableau aux modes d'explication seulement", () => {
    expect(tutorSystemPrompt("expliquer", "lycee")).toContain("```schema");
    expect(tutorSystemPrompt("decouvrir", "lycee")).toContain("[image:");
    expect(tutorSystemPrompt("exercer", "lycee")).not.toContain("```schema");
  });
});
