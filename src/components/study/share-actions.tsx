"use client";

import { useState, useTransition } from "react";

import { useT } from "@/i18n/client";
import { isMobileUserAgent, WHATSAPP_ICON, whatsappShareUrl, whatsappWebShareUrl } from "@/lib/challenge";
import { toHtml, toPlainText } from "@/lib/export-text";
import { needsSharePage, readMoreMessage, sharePath } from "@/lib/share-text";
import { createSharedTextAction } from "@/server/sharing/actions";

const buttonClass =
  "flex min-h-10 items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 text-sm font-medium dark:border-neutral-700 dark:bg-neutral-900";

/**
 * Copier (texte et mise en forme, pour Word, Excel, Docs), partager (menu du
 * téléphone) et WhatsApp en un geste (application, ou WhatsApp Web sur ordinateur).
 */
export function ShareActions({ title, markdown }: { title: string; markdown: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();
  const [shareError, setShareError] = useState<string | null>(null);

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

  /**
   * WhatsApp directement : l'application sur téléphone, WhatsApp Web sur
   * ordinateur. Un texte trop long pour un lien part en version courte, avec
   * « Lire la suite sur ATUMI » vers la page du texte complet.
   */
  function whatsapp() {
    const text = toPlainText(markdown, title);
    const mobile = isMobileUserAgent(navigator.userAgent);
    const open = (message: string, target: Window | null) => {
      const url = mobile ? whatsappShareUrl(message) : whatsappWebShareUrl(message);
      if (target) target.location.href = url;
      else if (mobile) window.location.href = url;
      else window.open(url, "_blank", "noopener,noreferrer");
    };
    if (!needsSharePage(text)) {
      open(text, null);
      return;
    }
    // Fenêtre ouverte dans le geste de l'élève (sinon bloquée), remplie après la préparation.
    const target = mobile ? null : window.open("", "_blank");
    setShareError(null);
    startTransition(async () => {
      const result = await createSharedTextAction(title, markdown);
      if ("error" in result) {
        target?.close();
        setShareError(result.error === "quota" ? t.share.quota : t.share.error);
        return;
      }
      open(readMoreMessage(text, t.share.readMore, `${window.location.origin}${sharePath(result.id)}`), target);
    });
  }

  /** Menu de partage du téléphone (WhatsApp, e-mail…) ; sinon WhatsApp directement. */
  async function share() {
    // Ordinateur, ou texte trop long pour un partage complet : WhatsApp avec « Lire la suite ».
    if (!navigator.share || !isMobileUserAgent(navigator.userAgent) || needsSharePage(toPlainText(markdown, title))) {
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
      <button type="button" onClick={whatsapp} disabled={pending} className={`${buttonClass} border-[#1fa855]/60 text-[#147a3d] disabled:opacity-60 dark:text-green-300`}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d={WHATSAPP_ICON} />
        </svg>
        {pending ? t.share.preparing : "WhatsApp"}
      </button>
      {shareError ? (
        <p role="alert" className="w-full text-xs text-red-700 dark:text-red-400">
          {shareError}
        </p>
      ) : null}
    </div>
  );
}
