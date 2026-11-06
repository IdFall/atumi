"use client";

import { useState } from "react";

import { getMessages } from "@/i18n/messages";
import { toHtml, toPlainText } from "@/lib/export-text";

const t = getMessages("fr");

const buttonClass =
  "flex min-h-10 items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 text-sm font-medium dark:border-neutral-700 dark:bg-neutral-900";

/**
 * Copier (texte et mise en forme, pour Word, Excel, Docs) et partager
 * (menu du téléphone : WhatsApp, e-mail…, sinon lien WhatsApp).
 */
export function ShareActions({ title, markdown }: { title: string; markdown: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const text = toPlainText(markdown, title);
    try {
      if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/plain": new Blob([text], { type: "text/plain" }),
            "text/html": new Blob([toHtml(markdown, title)], { type: "text/html" }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(text);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt(t.share.copyFallback, text);
    }
  }

  async function share() {
    const text = toPlainText(markdown, title);
    if (navigator.share) {
      try {
        await navigator.share({ title, text });
      } catch {
        // Partage annulé par l'apprenant : rien à faire.
      }
      return;
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={copy} className={buttonClass}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="9" y="9" width="11" height="11" rx="2" />
          <path d="M5 15V5a2 2 0 0 1 2-2h8" />
        </svg>
        <span aria-live="polite">{copied ? t.share.copied : t.share.copy}</span>
      </button>
      <button type="button" onClick={share} className={buttonClass}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
        </svg>
        {t.share.share}
      </button>
    </div>
  );
}
