/**
 * Lecture du Markdown produit par le modèle (synthèses, Prof ATUM, recherche)
 * en blocs à afficher, sans jamais interpréter de HTML. En plus du Markdown
 * simple (titres, puces, gras, renvois [p. N]), le « tableau » du Prof ATUM
 * comprend : formules LaTeX ($…$, $$…$$), encadrés (:::retenir … :::),
 * schémas (bloc ```schema en Mermaid), tableaux (| a | b |) et images
 * ([image: adresse | légende | page source]).
 */

export const BOX_KINDS = ["definition", "retenir", "exemple", "attention", "methode"] as const;
export type BoxKind = (typeof BOX_KINDS)[number];

export type Block =
  | { kind: "heading"; level: 2 | 3; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "list"; ordered: boolean; items: string[] }
  | { kind: "math"; tex: string }
  | { kind: "schema"; code: string }
  | { kind: "code"; code: string }
  | { kind: "table"; header: string[]; rows: string[][] }
  | { kind: "image"; src: string; caption: string; page: string | null }
  | { kind: "box"; box: BoxKind; title: string; blocks: Block[] };

export type Inline =
  | { kind: "text"; text: string }
  | { kind: "bold"; text: string }
  | { kind: "ref"; label: string }
  | { kind: "math"; tex: string };

/** Ligne d'image : [image: adresse ou mots-clés | légende | page source]. */
export const IMAGE_LINE = /^\[image:\s*([^|\]]+?)\s*(?:\|\s*([^|\]]*?)\s*)?(?:\|\s*([^|\]]*?)\s*)?\]$/i;

/** Seules les images de Wikimedia Commons, trouvées par le serveur, sont affichées. */
export function isAllowedImage(src: string): boolean {
  return /^https:\/\/upload\.wikimedia\.org\/[^\s"'<>]+$/.test(src);
}

export function isAllowedSourcePage(url: string | null): url is string {
  return !!url && /^https:\/\/commons\.wikimedia\.org\/wiki\/[^\s"'<>]+$/.test(url);
}

function boxKind(word: string): BoxKind {
  const w = word.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if ((BOX_KINDS as readonly string[]).includes(w)) return w as BoxKind;
  if (w.startsWith("def")) return "definition";
  if (w.startsWith("ex")) return "exemple";
  if (w.startsWith("att") || w === "piege" || w === "warning") return "attention";
  if (w.startsWith("meth") || w === "method") return "methode";
  return "retenir";
}

function tableCells(line: string): string[] {
  return line
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

export function parseBoard(markdown: string): Block[] {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  let i = 0;

  function parseUntil(stop: (line: string) => boolean): Block[] {
    const blocks: Block[] = [];
    let paragraph: string[] = [];
    let list: { ordered: boolean; items: string[] } | null = null;
    const flush = () => {
      if (paragraph.length) blocks.push({ kind: "paragraph", text: paragraph.join(" ") });
      paragraph = [];
      if (list) blocks.push({ kind: "list", ...list });
      list = null;
    };

    while (i < lines.length) {
      const line = lines[i].trim();
      if (stop(line)) {
        i++;
        break;
      }

      // Bloc de code : ```schema / ```mermaid = schéma, sinon code brut.
      const fence = /^```\s*([\w-]*)/.exec(line);
      if (fence) {
        flush();
        const lang = fence[1].toLowerCase();
        const body: string[] = [];
        i++;
        while (i < lines.length && !lines[i].trim().startsWith("```")) body.push(lines[i++]);
        i++;
        const code = body.join("\n").trim();
        if (code) blocks.push(lang === "schema" || lang === "mermaid" ? { kind: "schema", code } : { kind: "code", code });
        continue;
      }

      // Formule centrée : $$ … $$ ou \[ … \], sur une ou plusieurs lignes.
      if (line.startsWith("$$") || line.startsWith("\\[")) {
        flush();
        const close = line.startsWith("$$") ? "$$" : "\\]";
        let text = line.slice(2);
        while (!text.trimEnd().endsWith(close) && i + 1 < lines.length) text += "\n" + lines[++i].trim();
        i++;
        const tex = text.trimEnd().endsWith(close) ? text.trimEnd().slice(0, -2).trim() : text.trim();
        if (tex) blocks.push({ kind: "math", tex });
        continue;
      }

      // Encadré : :::retenir Titre … :::
      const box = /^:::\s*([\p{L}-]+)\s*(.*)$/u.exec(line);
      if (box) {
        flush();
        i++;
        const inner = parseUntil((l) => /^:::\s*$/.test(l));
        blocks.push({ kind: "box", box: boxKind(box[1]), title: box[2].trim(), blocks: inner });
        continue;
      }

      const image = IMAGE_LINE.exec(line);
      if (image) {
        flush();
        blocks.push({ kind: "image", src: image[1], caption: image[2] ?? "", page: image[3] || null });
        i++;
        continue;
      }

      if (line.startsWith("|") && line.endsWith("|") && line.length > 2) {
        flush();
        const rows: string[][] = [];
        while (i < lines.length && /^\|.*\|$/.test(lines[i].trim())) {
          const cells = tableCells(lines[i].trim());
          if (!cells.every((c) => /^:?-{2,}:?$/.test(c))) rows.push(cells);
          i++;
        }
        if (rows.length) blocks.push({ kind: "table", header: rows[0], rows: rows.slice(1) });
        continue;
      }

      const heading = /^(#{1,4})\s+(.*)$/.exec(line);
      const bullet = /^[-*•]\s+(.*)$/.exec(line);
      const numbered = /^\d+[.)]\s+(.*)$/.exec(line);
      if (heading) {
        flush();
        blocks.push({ kind: "heading", level: heading[1].length <= 2 ? 2 : 3, text: heading[2] });
      } else if (bullet || numbered) {
        const ordered = !bullet;
        if (paragraph.length || (list && list.ordered !== ordered)) flush();
        list ??= { ordered, items: [] };
        list.items.push((bullet ?? numbered)![1]);
      } else if (line === "") {
        flush();
      } else {
        if (list) flush();
        paragraph.push(line);
      }
      i++;
    }
    flush();
    return blocks;
  }

  return parseUntil(() => false);
}

/** Gras, renvois de page et formules dans une ligne ; le reste est du texte brut. */
export function parseInline(text: string): Inline[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\[p\.\s*\d+\]|\[doc\]|\$[^$\n]+\$|\\\(.+?\\\))/g);
  const out: Inline[] = [];
  for (const part of parts) {
    if (!part) continue;
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) out.push({ kind: "bold", text: part.slice(2, -2) });
    else if (/^\[(p\.\s*\d+|doc)\]$/.test(part)) out.push({ kind: "ref", label: part.slice(1, -1) });
    else if (part.length > 2 && part.startsWith("$") && part.endsWith("$")) out.push({ kind: "math", tex: part.slice(1, -1).trim() });
    else if (part.startsWith("\\(") && part.endsWith("\\)")) out.push({ kind: "math", tex: part.slice(2, -2).trim() });
    else out.push({ kind: "text", text: part });
  }
  return out;
}

/** Vrai si la réponse utilise les éléments du tableau (formule, encadré, schéma, tableau, image). */
export function usesBoard(blocks: readonly Block[]): boolean {
  return blocks.some(
    (b) =>
      b.kind === "math" ||
      b.kind === "schema" ||
      b.kind === "table" ||
      b.kind === "box" ||
      (b.kind === "image" && isAllowedImage(b.src)),
  );
}
