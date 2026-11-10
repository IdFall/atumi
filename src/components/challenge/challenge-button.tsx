"use client";

import { useState, useTransition } from "react";

import { fill } from "@/i18n/format";
import { useT } from "@/i18n/client";
import { challengePath, whatsappShareUrl } from "@/lib/challenge";
import { createChallengeAction } from "@/server/challenges/actions";

/**
 * « Défier un ami » après la correction : crée le lien du défi puis ouvre le
 * menu de partage du téléphone (WhatsApp en tête), sinon WhatsApp directement.
 */
export function ChallengeButton({ quizId }: { quizId: string }) {
  const c = useT().challenge;
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

  function challenge() {
    setFailed(false);
    startTransition(async () => {
      const result = await createChallengeAction(quizId);
      if ("error" in result) {
        setFailed(true);
        return;
      }
      const url = `${window.location.origin}${challengePath(result.id)}`;
      const text = fill(c.shareText, { correct: result.correct, total: result.total, subject: result.subject, url });
      if (navigator.share) {
        try {
          await navigator.share({ text });
        } catch {
          // Partage annulé : rien à faire.
        }
        return;
      }
      window.open(whatsappShareUrl(text), "_blank", "noopener,noreferrer");
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={challenge}
        disabled={pending}
        className="flex items-center justify-center gap-2 rounded-xl bg-[#1fa855] px-4 py-3 font-semibold text-white shadow-md disabled:opacity-60"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.4.1-.6.3-.2.2-.8.8-.8 2s.8 2.3.9 2.5c.1.2 1.6 2.5 4 3.5 1.5.6 2 .7 2.8.6.4-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2l-.4-.2z" />
        </svg>
        {pending ? c.preparing : c.button}
      </button>
      <p className="text-center text-xs text-neutral-600 dark:text-neutral-300">{c.privacy}</p>
      {failed ? (
        <p role="alert" className="text-center text-sm text-red-700 dark:text-red-400">
          {c.error}
        </p>
      ) : null}
    </div>
  );
}
