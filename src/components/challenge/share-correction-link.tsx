"use client";

import { useEffect, useState } from "react";

import { fill } from "@/i18n/format";
import { useT } from "@/i18n/client";
import { challengePath, isMobileUserAgent, WHATSAPP_ICON, whatsappShareUrl, whatsappWebShareUrl } from "@/lib/challenge";

/** Défi classe dont la correction est publiée : renvoyer le lien dans le groupe WhatsApp. */
export function ShareCorrectionLink({ challengeId, subject }: { challengeId: string; subject: string }) {
  const c = useT().challenge;
  const [href, setHref] = useState<string | null>(null);
  useEffect(() => {
    const text = fill(c.correctionShareText, { subject, url: `${window.location.origin}${challengePath(challengeId)}` });
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHref(isMobileUserAgent(navigator.userAgent) ? whatsappShareUrl(text) : whatsappWebShareUrl(text));
  }, [c.correctionShareText, challengeId, subject]);
  return (
    <a
      href={href ?? undefined}
      target="_blank"
      rel="noopener noreferrer"
      aria-disabled={href === null}
      className="flex items-center justify-center gap-2 rounded-xl bg-[#1fa855] px-4 py-3 font-semibold text-white shadow-md"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d={WHATSAPP_ICON} />
      </svg>
      {c.shareCorrection}
    </a>
  );
}
