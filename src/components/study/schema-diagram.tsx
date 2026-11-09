"use client";

import { useEffect, useId, useState } from "react";

/**
 * Schéma du tableau (diagramme Mermaid écrit par le modèle). Mermaid n'est
 * chargé que lorsqu'un schéma est affiché ; mode « strict » : pas de HTML ni
 * de clic dans les libellés, SVG nettoyé par Mermaid (DOMPurify). Si le
 * schéma est invalide, on montre son texte.
 */
export function SchemaDiagram({ code, label }: { code: string; label: string }) {
  const id = `schema-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const [svg, setSvg] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { default: mermaid } = await import("mermaid");
        const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: dark ? "dark" : "base",
          themeVariables: dark ? {} : { primaryColor: "#EDE8FC", primaryBorderColor: "#7557D9", lineColor: "#071A33", fontFamily: "inherit" },
          flowchart: { htmlLabels: false },
        });
        const result = await mermaid.render(id, code.slice(0, 4000));
        if (!cancelled) setSvg(result.svg);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code, id]);

  if (failed) {
    return <pre className="overflow-x-auto rounded-lg bg-neutral-100 p-3 text-sm dark:bg-neutral-900">{code}</pre>;
  }
  return (
    <figure
      role="img"
      aria-label={label}
      className="flex min-h-24 items-center justify-center overflow-x-auto rounded-xl bg-white p-3 dark:bg-neutral-950 [&_svg]:h-auto [&_svg]:max-w-full"
      // SVG produit et nettoyé par Mermaid en mode strict.
      dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}
    >
      {svg ? undefined : <span className="text-sm text-neutral-500">…</span>}
    </figure>
  );
}
