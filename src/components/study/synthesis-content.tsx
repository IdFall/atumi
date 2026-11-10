import type { ReactNode } from "react";

import { getT } from "@/i18n/server";
import { isAllowedImage, isAllowedSourcePage, parseBoard, parseInline, type Block, type BoxKind } from "@/lib/board";

import { renderTex } from "./math-text";
import { SchemaDiagram } from "./schema-diagram";

/**
 * Affiche le Markdown produit par le modèle (synthèses, Prof NEO, recherche)
 * sans jamais injecter de HTML venu du modèle : titres, puces, gras, renvois
 * [p. N], formules (rendues par KaTeX, sans commandes de confiance), encadrés,
 * tableaux, schémas (Mermaid en mode strict) et images de Wikimedia Commons.
 */
export async function SynthesisContent({ markdown }: { markdown: string }) {
  const t = await getT();
  const blocks = parseBoard(markdown);
  return (
    <div className="flex min-w-0 flex-col gap-3 text-[15px] leading-relaxed">
      {blocks.map((b, i) => (
        <BlockView key={i} block={b} labels={t.board} />
      ))}
    </div>
  );
}

type BoardLabels = Awaited<ReturnType<typeof getT>>["board"];

const BOX_STYLE: Record<BoxKind, string> = {
  definition: "border-primary bg-primary-soft/60 dark:bg-primary-strong/20",
  retenir: "border-accent bg-accent/10",
  exemple: "border-electrique bg-electrique/10",
  attention: "border-orange-500 bg-orange-50 dark:bg-orange-950/40",
  methode: "border-lavande bg-lavande/20",
};

const BOX_ICON: Record<BoxKind, string> = {
  definition: "📘",
  retenir: "⭐",
  exemple: "✏️",
  attention: "⚠️",
  methode: "🧭",
};

const tex = renderTex;

function BlockView({ block, labels }: { block: Block; labels: BoardLabels }): ReactNode {
  switch (block.kind) {
    case "heading": {
      const Tag = block.level === 2 ? "h2" : "h3";
      return <Tag className={block.level === 2 ? "mt-2 text-lg font-semibold" : "font-semibold"}>{inline(block.text)}</Tag>;
    }
    case "paragraph":
      return <p>{inline(block.text)}</p>;
    case "list": {
      const Tag = block.ordered ? "ol" : "ul";
      return (
        <Tag className={`flex flex-col gap-1.5 pl-5 ${block.ordered ? "list-decimal" : "list-disc"}`}>
          {block.items.map((item, i) => (
            <li key={i}>{inline(item)}</li>
          ))}
        </Tag>
      );
    }
    case "math":
      return <div className="overflow-x-auto py-1 text-center" dangerouslySetInnerHTML={{ __html: tex(block.tex, true) }} />;
    case "schema":
      return <SchemaDiagram code={block.code} label={labels.schema} />;
    case "code":
      return <pre className="overflow-x-auto rounded-lg bg-neutral-100 p-3 text-sm dark:bg-neutral-900">{block.code}</pre>;
    case "table":
      return (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                {block.header.map((c, i) => (
                  <th key={i} className="border border-neutral-300 bg-neutral-100 px-2 py-1.5 text-left font-semibold dark:border-neutral-700 dark:bg-neutral-800">
                    {inline(c)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, r) => (
                <tr key={r}>
                  {row.map((c, i) => (
                    <td key={i} className="border border-neutral-300 px-2 py-1.5 align-top dark:border-neutral-700">
                      {inline(c)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "image":
      if (!isAllowedImage(block.src)) return null;
      return (
        <figure className="flex flex-col items-center gap-1">
          {/* Image de Wikimedia Commons choisie par le serveur ; taille inconnue d'avance. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={block.src} alt={block.caption} loading="lazy" referrerPolicy="no-referrer" className="max-h-80 w-auto max-w-full rounded-lg bg-white object-contain" />
          <figcaption className="text-center text-xs text-neutral-500">
            {block.caption}
            {isAllowedSourcePage(block.page) ? (
              <>
                {" · "}
                <a href={block.page} target="_blank" rel="noopener noreferrer" className="underline">
                  {labels.imageSource}
                </a>
              </>
            ) : null}
          </figcaption>
        </figure>
      );
    case "box":
      return (
        <aside className={`flex flex-col gap-2 rounded-xl border-l-4 px-4 py-3 ${BOX_STYLE[block.box]}`}>
          <p className="text-sm font-bold uppercase tracking-wide">
            <span aria-hidden>{BOX_ICON[block.box]} </span>
            {block.title ? inline(block.title) : labels.boxes[block.box]}
          </p>
          {block.blocks.map((b, i) => (
            <BlockView key={i} block={b} labels={labels} />
          ))}
        </aside>
      );
  }
}

function inline(text: string): ReactNode[] {
  return parseInline(text).map((part, i) => {
    switch (part.kind) {
      case "bold":
        return <strong key={i}>{inline(part.text)}</strong>;
      case "ref":
        return (
          <span key={i} className="ml-1 rounded bg-primary-soft px-1 text-xs font-medium text-primary-strong dark:bg-primary-strong/25 dark:text-lavande">
            {part.label}
          </span>
        );
      case "math":
        return <span key={i} dangerouslySetInnerHTML={{ __html: tex(part.tex, false) }} />;
      case "text":
        return part.text;
    }
  });
}
