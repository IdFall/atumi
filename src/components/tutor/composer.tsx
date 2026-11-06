"use client";

import { useActionState, useRef } from "react";

import { fill } from "@/i18n/format";
import { getMessages } from "@/i18n/messages";
import type { TutorMode } from "@/server/ai/prompts";
import { sendTutorMessageAction, type TutorFormState } from "@/server/tutor/actions";

const t = getMessages("fr");

export function TutorComposer({
  conversationId,
  mode,
  moduleId,
  chapterId,
  messagesLeft,
  messageLimit,
  quickReplies,
}: {
  conversationId: string | null;
  mode: TutorMode;
  moduleId: string | null;
  chapterId: string | null;
  messagesLeft: number | null;
  messageLimit: number | null;
  quickReplies: boolean;
}) {
  const [state, formAction, pending] = useActionState<TutorFormState, FormData>(sendTutorMessageAction, {});
  const formRef = useRef<HTMLFormElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const exhausted = messagesLeft === 0;

  const quick = (text: string) => {
    if (!textRef.current || !formRef.current) return;
    textRef.current.value = text;
    formRef.current.requestSubmit();
  };

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex flex-col gap-2"
    >
      <input type="hidden" name="conversationId" value={conversationId ?? ""} />
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="moduleId" value={moduleId ?? ""} />
      <input type="hidden" name="chapterId" value={chapterId ?? ""} />

      {pending ? (
        <p role="status" className="text-sm text-amber-800 dark:text-amber-300">
          {t.tutor.thinking}
        </p>
      ) : null}

      {quickReplies && !exhausted ? (
        <div className="flex flex-wrap gap-1.5">
          {Object.values(t.tutor.quickReplies).map((label) => (
            <button
              key={label}
              type="button"
              disabled={pending}
              onClick={() => quick(label)}
              className="rounded-full border border-neutral-300 px-3 py-1 text-sm disabled:opacity-50 dark:border-neutral-700"
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}

      {exhausted ? (
        <p className="rounded-lg bg-orange-50 p-3 text-sm text-orange-900 dark:bg-orange-950 dark:text-orange-100">{t.tutor.noMessagesLeft}</p>
      ) : (
        <div className="flex gap-2">
          <textarea
            ref={textRef}
            name="text"
            required
            rows={2}
            maxLength={4000}
            disabled={pending}
            placeholder={mode === "exercer" ? t.tutor.exercisePlaceholder : mode === "decouvrir" ? t.tutor.discoverPlaceholder : t.tutor.placeholder}
            className="min-w-0 flex-1 resize-none rounded-xl border border-neutral-300 bg-white px-3 py-2 text-base outline-none focus:ring-2 focus:ring-amber-600 dark:border-neutral-700 dark:bg-neutral-900"
          />
          <button
            type="submit"
            disabled={pending}
            aria-label={t.tutor.send}
            className="flex w-12 items-center justify-center rounded-xl bg-amber-700 text-white disabled:opacity-60"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </button>
        </div>
      )}

      {messagesLeft !== null && messageLimit !== null && !exhausted ? (
        <p className="text-xs text-neutral-500">{fill(t.tutor.messagesLeft, { n: messagesLeft, total: messageLimit })}</p>
      ) : null}
      {state.error ? (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {t.tutor.errors[state.error]}
        </p>
      ) : null}
    </form>
  );
}
