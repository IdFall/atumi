"use client";

import { useState } from "react";

import { useT } from "@/i18n/client";

/** Bouton « Copier » à côté d'un numéro de paiement (sans espaces, prêt à coller dans Wave/OM). */
export function CopyNumber({ number }: { number: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const digits = number.replace(/\s+/g, "");

  async function copy() {
    try {
      await navigator.clipboard.writeText(digits);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt(t.share.copyFallback, digits);
    }
  }

  return (
    <button type="button" onClick={copy} className="text-xs font-semibold text-primary underline dark:text-lavande">
      {copied ? t.subscribe.copied : t.subscribe.copy}
    </button>
  );
}
