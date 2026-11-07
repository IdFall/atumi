/**
 * Mise en forme d'une explication (Markdown simple) pour la copier vers un autre
 * outil : texte brut pour WhatsApp ou SMS, HTML pour Word, Google Docs ou Excel.
 * Utilisable dans le navigateur comme sur le serveur.
 */

/** Formules LaTeX courantes rendues lisibles sans éditeur d'équations. */
function simplifyMath(text: string): string {
  return text
    .replace(/\$\$?([^$]+)\$\$?/g, (_m, formula: string) =>
      formula
        .replace(/\\int/g, "∫")
        .replace(/\\sum/g, "Σ")
        .replace(/\\infty/g, "∞")
        .replace(/\\to/g, "→")
        .replace(/\\leq?/g, "≤")
        .replace(/\\geq?/g, "≥")
        .replace(/\\neq/g, "≠")
        .replace(/\\times/g, "×")
        .replace(/\\cdot/g, "·")
        .replace(/\\pi/g, "π")
        .replace(/\\sqrt\{([^}]*)\}/g, "√($1)")
        .replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, "($1)/($2)")
        .replace(/\\(left|right)/g, "")
        .replace(/[{}]/g, "")
        .replace(/\\/g, "")
        .trim(),
    );
}

function plainInline(text: string): string {
  return simplifyMath(text).replace(/\*\*([^*]+)\*\*/g, "$1");
}

/** Texte brut : titres en majuscules, puces « • », formules simplifiées. */
export function toPlainText(markdown: string, title?: string): string {
  const lines = markdown.split("\n").map((raw) => {
    const line = raw.trim();
    const heading = /^#{1,4}\s+(.*)$/.exec(line);
    if (heading) return `\n${plainInline(heading[1]).toUpperCase()}`;
    const bullet = /^[-*•]\s+(.*)$/.exec(line);
    if (bullet) return `• ${plainInline(bullet[1])}`;
    return plainInline(line);
  });
  const body = lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return title ? `${title}\n\n${body}\n\n— LULU` : `${body}\n\n— LULU`;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function htmlInline(text: string): string {
  return escapeHtml(simplifyMath(text)).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

/** HTML simple : Word et Excel gardent les titres, le gras et les listes au collage. */
export function toHtml(markdown: string, title?: string): string {
  const out: string[] = title ? [`<h1>${escapeHtml(title)}</h1>`] : [];
  let inList = false;
  for (const raw of markdown.split("\n")) {
    const line = raw.trim();
    const heading = /^#{1,4}\s+(.*)$/.exec(line);
    const bullet = /^[-*•]\s+(.*)$/.exec(line);
    if (!bullet && inList) {
      out.push("</ul>");
      inList = false;
    }
    if (heading) out.push(`<h2>${htmlInline(heading[1])}</h2>`);
    else if (bullet) {
      if (!inList) out.push("<ul>");
      inList = true;
      out.push(`<li>${htmlInline(bullet[1])}</li>`);
    } else if (line) out.push(`<p>${htmlInline(line)}</p>`);
  }
  if (inList) out.push("</ul>");
  return out.join("");
}
