import Image from "next/image";

import { ShareActions } from "@/components/study/share-actions";
import { SynthesisContent } from "@/components/study/synthesis-content";
import { getT } from "@/i18n/server";
import type { TutorMessage } from "@/server/tutor/queries";
import { LOCALES } from "@/config/countries";
import { getMessages } from "@/i18n/messages";
import { parseBoard, usesBoard } from "@/lib/board";

import { BoardFrame } from "./board-frame";

/** Message fixe « professeur indisponible », dans toutes les langues : affiché en rouge. */
const UNAVAILABLE = new Set(LOCALES.map((l) => getMessages(l).tutor.unavailable));

export async function MessageList({ messages }: { messages: TutorMessage[] }) {
  const t = await getT();
  return (
    <ol className="flex flex-col gap-3">
      {messages.map((m) =>
        m.role === "user" ? (
          <li key={m.id} className="max-w-[85%] self-end whitespace-pre-wrap rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-white">
            {m.content}
          </li>
        ) : !UNAVAILABLE.has(m.content) && usesBoard(parseBoard(m.content)) ? (
          // Explication au tableau : pleine largeur, formules, schémas, images.
          <li key={m.id} className="flex w-full flex-col gap-2 self-stretch">
            <div className="flex items-center gap-2">
              <Image src="/prof-atumi.svg" alt="" width={28} height={28} className="shrink-0" />
              <span className="text-sm font-semibold text-primary-strong dark:text-lavande">{t.tutor.name}</span>
            </div>
            <BoardFrame
              footer={
                <>
                  {m.citations.length > 0 ? (
                    <p className="mb-1 text-xs text-neutral-500">
                      {t.tutor.sources} : {m.citations.map((c) => `${c.documentTitle}${c.page ? `, p. ${c.page}` : ""}`).join(" · ")}
                    </p>
                  ) : null}
                  <ShareActions title={t.tutor.name} markdown={m.content} />
                </>
              }
            >
              <SynthesisContent markdown={m.content} />
            </BoardFrame>
          </li>
        ) : (
          <li key={m.id} className="flex max-w-[92%] items-end gap-2 self-start">
            <Image src="/prof-atumi.svg" alt="" width={28} height={28} className="shrink-0" />
            <div className="flex min-w-0 flex-col gap-2 rounded-2xl rounded-bl-sm border border-neutral-200 bg-white px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900">
              {UNAVAILABLE.has(m.content) ? (
                <p role="alert" className="font-semibold text-red-600 dark:text-red-400">
                  {m.content}
                </p>
              ) : (
                <SynthesisContent markdown={m.content} />
              )}
              {m.citations.length > 0 ? (
                <p className="text-xs text-neutral-500">
                  {t.tutor.sources} : {m.citations.map((c) => `${c.documentTitle}${c.page ? `, p. ${c.page}` : ""}`).join(" · ")}
                </p>
              ) : null}
              <ShareActions title={t.tutor.name} markdown={m.content} />
            </div>
          </li>
        ),
      )}
    </ol>
  );
}
