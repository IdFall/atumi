import "katex/dist/katex.min.css";

import katex from "katex";

import { parseInline } from "@/lib/board";

/** Formule LaTeX en HTML (KaTeX, sans commandes de confiance). */
export function renderTex(source: string, displayMode: boolean): string {
  return katex.renderToString(source, {
    displayMode,
    throwOnError: false,
    trust: false,
    strict: "ignore",
    maxSize: 20,
    maxExpand: 200,
    output: "htmlAndMathml",
  });
}

/**
 * Texte court du quiz (question, proposition, explication) : les formules
 * $…$ ou \( … \) sont affichées par KaTeX, le reste reste du texte brut.
 */
export function MathText({ text }: { text: string }) {
  return (
    <>
      {parseInline(text).map((part, i) => {
        switch (part.kind) {
          case "math":
            return <span key={i} dangerouslySetInnerHTML={{ __html: renderTex(part.tex, false) }} />;
          case "bold":
            return <strong key={i}>{part.text}</strong>;
          case "ref":
            return <span key={i}>[{part.label}]</span>;
          default:
            return <span key={i}>{part.text}</span>;
        }
      })}
    </>
  );
}
