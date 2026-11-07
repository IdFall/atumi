import type { ReactNode } from "react";

/**
 * Affiche la synthèse (Markdown simple produit par le modèle) sans jamais
 * injecter de HTML : titres « ## », puces « - », gras, renvois [p. N].
 */
export function SynthesisContent({ markdown }: { markdown: string }) {
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  let paragraph: string[] = [];

  const flushList = () => {
    if (list.length === 0) return;
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="flex list-disc flex-col gap-1.5 pl-5">
        {list.map((item, i) => (
          <li key={i}>{inline(item)}</li>
        ))}
      </ul>,
    );
    list = [];
  };
  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    blocks.push(<p key={`p-${blocks.length}`}>{inline(paragraph.join(" "))}</p>);
    paragraph = [];
  };

  for (const rawLine of markdown.split("\n")) {
    const line = rawLine.trim();
    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    const bullet = /^[-*•]\s+(.*)$/.exec(line);
    if (heading) {
      flushList();
      flushParagraph();
      const Tag = heading[1].length <= 2 ? "h2" : "h3";
      blocks.push(
        <Tag key={`h-${blocks.length}`} className={Tag === "h2" ? "mt-2 text-lg font-semibold" : "font-semibold"}>
          {inline(heading[2])}
        </Tag>,
      );
    } else if (bullet) {
      flushParagraph();
      list.push(bullet[1]);
    } else if (line === "") {
      flushList();
      flushParagraph();
    } else {
      flushList();
      paragraph.push(line);
    }
  }
  flushList();
  flushParagraph();

  return <div className="flex flex-col gap-3 text-[15px] leading-relaxed">{blocks}</div>;
}

/** Gras et renvois de page ; le reste est du texte brut (échappé par React). */
function inline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\[p\.\s*\d+\]|\[doc\])/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (/^\[(p\.\s*\d+|doc)\]$/.test(part)) {
      return (
        <span key={i} className="ml-1 rounded bg-primary-soft px-1 text-xs font-medium text-primary-strong dark:bg-primary-strong/25 dark:text-lavande">
          {part.slice(1, -1)}
        </span>
      );
    }
    return part;
  });
}
