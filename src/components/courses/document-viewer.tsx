"use client";

import { useEffect, useRef, useState } from "react";

import { isSafeImageSource, isSafeLink, type ViewerKind } from "@/lib/document-view";

interface Labels {
  loading: string;
  failed: string;
  page: string;
}

/**
 * Affiche le fichier importé dans la page, sans dépendre d'un lecteur du téléphone :
 * - PDF : chaque page est dessinée dans un canevas (pdf.js, livré avec unpdf) ;
 * - Word : converti en HTML dans le navigateur (mammoth), puis nettoyé ;
 * - photo : affichée telle quelle.
 * Le fichier ne quitte pas le navigateur : il est lu depuis un lien signé de courte durée.
 */
export function DocumentViewer({ kind, url, title, labels }: { kind: ViewerKind; url: string; title: string; labels: Labels }) {
  if (kind === "image") return <ImageView url={url} title={title} labels={labels} />;
  if (kind === "pdf") return <PdfView url={url} labels={labels} />;
  if (kind === "docx") return <DocxView url={url} labels={labels} />;
  return <Failed labels={labels} />;
}

type LoadState = "loading" | "ready" | "failed";

function Loading({ labels }: { labels: Labels }) {
  return (
    <p role="status" className="py-10 text-center text-sm text-neutral-600 dark:text-neutral-300">
      {labels.loading}
    </p>
  );
}

function Failed({ labels }: { labels: Labels }) {
  return (
    <p role="alert" className="rounded-xl bg-orange-50 p-4 text-sm text-orange-900 dark:bg-orange-950 dark:text-orange-100">
      {labels.failed}
    </p>
  );
}

function ImageView({ url, title, labels }: { url: string; title: string; labels: Labels }) {
  const [state, setState] = useState<LoadState>("loading");
  const image = useRef<HTMLImageElement>(null);

  // L'image peut avoir fini de charger avant que React ne branche onLoad.
  useEffect(() => {
    const element = image.current;
    if (element?.complete) setState(element.naturalWidth > 0 ? "ready" : "failed");
  }, [url]);

  return (
    <>
      {state === "loading" ? <Loading labels={labels} /> : null}
      {state === "failed" ? <Failed labels={labels} /> : null}
      {/* Lien signé externe : next/image n'apporte rien ici (fichier privé, déjà à la bonne taille). */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={image}
        src={url}
        alt={title}
        onLoad={() => setState("ready")}
        onError={() => setState("failed")}
        className={state === "ready" ? "h-auto w-full rounded-lg bg-white shadow-sm" : "hidden"}
      />
    </>
  );
}

async function fetchBytes(url: string, signal: AbortSignal): Promise<ArrayBuffer> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Téléchargement impossible : ${response.status}`);
  return response.arrayBuffer();
}

function PdfView({ url, labels }: { url: string; labels: Labels }) {
  const container = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<LoadState>("loading");

  useEffect(() => {
    const controller = new AbortController();
    let pdf: { cleanup(): Promise<unknown> } | null = null;

    (async () => {
      const bytes = await fetchBytes(url, controller.signal);
      const { getDocumentProxy } = await import("unpdf");
      const doc = await getDocumentProxy(new Uint8Array(bytes));
      pdf = doc;
      const root = container.current;
      if (controller.signal.aborted || !root) return;
      root.replaceChildren();

      for (let n = 1; n <= doc.numPages; n++) {
        if (controller.signal.aborted) return;
        const page = await doc.getPage(n);
        const width = root.clientWidth || 600;
        const base = page.getViewport({ scale: 1 });
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        const viewport = page.getViewport({ scale: (width / base.width) * ratio });

        const canvas = document.createElement("canvas");
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.className = "h-auto w-full rounded-lg bg-white shadow-sm";
        canvas.setAttribute("role", "img");
        canvas.setAttribute("aria-label", `${labels.page} ${n}`);
        root.append(canvas);

        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canevas indisponible");
        await page.render({ canvas, canvasContext: context, viewport }).promise;
        page.cleanup();
        // La première page suffit pour retirer le message d'attente.
        if (n === 1) setState("ready");
      }
    })().catch(() => {
      if (!controller.signal.aborted) setState("failed");
    });

    return () => {
      controller.abort();
      void pdf?.cleanup();
    };
  }, [url, labels.page]);

  return (
    <>
      {state === "loading" ? <Loading labels={labels} /> : null}
      {state === "failed" ? <Failed labels={labels} /> : null}
      <div ref={container} className={state === "failed" ? "hidden" : "flex flex-col gap-3"} />
    </>
  );
}

function DocxView({ url, labels }: { url: string; labels: Labels }) {
  const container = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<LoadState>("loading");

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      const arrayBuffer = await fetchBytes(url, controller.signal);
      const mammoth = await import("mammoth");
      const { value } = await mammoth.convertToHtml({ arrayBuffer });
      const root = container.current;
      if (controller.signal.aborted || !root) return;
      root.replaceChildren(...cleanHtml(value));
      setState("ready");
    })().catch(() => {
      if (!controller.signal.aborted) setState("failed");
    });
    return () => controller.abort();
  }, [url]);

  return (
    <>
      {state === "loading" ? <Loading labels={labels} /> : null}
      {state === "failed" ? <Failed labels={labels} /> : null}
      <div
        ref={container}
        className={
          state === "ready"
            ? "document-content rounded-lg bg-white p-5 text-neutral-900 shadow-sm"
            : "hidden"
        }
      />
    </>
  );
}

/** Balises produites par mammoth que l'on garde ; tout le reste est remplacé par son texte. */
const ALLOWED_TAGS = new Set([
  "P", "BR", "STRONG", "B", "EM", "I", "U", "S", "SUB", "SUP",
  "H1", "H2", "H3", "H4", "H5", "H6", "UL", "OL", "LI",
  "TABLE", "THEAD", "TBODY", "TR", "TH", "TD", "A", "IMG", "BLOCKQUOTE",
]);

/**
 * Le contenu du document est une donnée : on reconstruit un arbre DOM ne
 * contenant que des balises connues, sans attributs hormis les liens web et
 * les images intégrées au fichier.
 */
function cleanHtml(html: string): Node[] {
  const source = new DOMParser().parseFromString(html, "text/html");
  const copy = (node: Node): Node[] => {
    if (node.nodeType === Node.TEXT_NODE) return [document.createTextNode(node.textContent ?? "")];
    if (node.nodeType !== Node.ELEMENT_NODE) return [];
    const element = node as Element;
    const children = Array.from(element.childNodes).flatMap(copy);
    if (!ALLOWED_TAGS.has(element.tagName)) return children;

    const out = document.createElement(element.tagName.toLowerCase());
    if (element.tagName === "A") {
      const href = element.getAttribute("href") ?? "";
      if (isSafeLink(href)) {
        out.setAttribute("href", href);
        out.setAttribute("target", "_blank");
        out.setAttribute("rel", "noopener noreferrer nofollow");
      }
    }
    if (element.tagName === "IMG") {
      const src = element.getAttribute("src") ?? "";
      if (!isSafeImageSource(src)) return [];
      out.setAttribute("src", src);
      out.setAttribute("alt", element.getAttribute("alt") ?? "");
    }
    for (const attr of ["colspan", "rowspan"]) {
      const value = element.getAttribute(attr);
      if (value && /^\d{1,2}$/.test(value)) out.setAttribute(attr, value);
    }
    out.append(...children);
    return [out];
  };
  return Array.from(source.body.childNodes).flatMap(copy);
}
