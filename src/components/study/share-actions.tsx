"use client";

import { useState } from "react";

import { useT } from "@/i18n/client";
import { isMobileUserAgent, WHATSAPP_ICON, whatsappShareUrl, whatsappWebShareUrl } from "@/lib/challenge";
import { toHtml, toPlainText } from "@/lib/export-text";

/** Un lien WhatsApp trop long ne s'ouvre pas : le texte est coupé, l'élève peut tout copier. */
const WHATSAPP_MAX_CHARS = 3500;

function shareableText(text: string): string {
  return text.length <= WHATSAPP_MAX_CHARS ? text : `${text.slice(0, WHATSAPP_MAX_CHARS).trimEnd()}…`;
}

const buttonClass =
  "flex min-h-10 items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 text-sm font-medium dark:border-neutral-700 dark:bg-neutral-900";

/**
 * Copier (texte et mise en forme, pour Word, Excel, Docs), partager (menu du
 * téléphone) et WhatsApp en un geste (application, ou WhatsApp Web sur ordinateur).
 */
export function ShareActions({ title, markdown }: { title: string; markdown: string }) {
  const t = useT();
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

  /** WhatsApp directement : l'application sur téléphone, WhatsApp Web sur ordinateur. */
  function whatsapp() {
    const text = shareableText(toPlainText(markdown, title));
    const mobile = isMobileUserAgent(navigator.userAgent);
    // Ouvert dans le geste de l'élève : le navigateur ne bloque pas la fenêtre.
    window.open(mobile ? whatsappShareUrl(text) : whatsappWebShareUrl(text), "_blank", "noopener,noreferrer");
  }

  /** Menu de partage du téléphone (WhatsApp, e-mail…) ; sinon WhatsApp directement. */
  async function share() {
    if (!navigator.share || !isMobileUserAgent(navigator.userAgent)) {
      whatsapp();
      return;
    }
    try {
      await navigator.share({ title, text: toPlainText(markdown, title) });
    } catch {
      // Partage annulé par l'apprenant : rien à faire.
    }
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
      <button type="button" onClick={whatsapp} className={`${buttonClass} border-[#1fa855]/60 text-[#147a3d] dark:text-green-300`}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d={WHATSAPP_ICON} />
        </svg>
        WhatsApp
      </button>
    </div>
  );
}
