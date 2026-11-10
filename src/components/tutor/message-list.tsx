import Image from "next/image";

import { ShareActions } from "@/components/study/share-actions";
import { SynthesisContent } from "@/components/study/synthesis-content";
import { getT } from "@/i18n/server";
import type { TutorMessage } from "@/server/tutor/queries";
import { LOCALES } from "@/config/countries";
import { getMessages } from "@/i18n/messages";
import { parseBoard, usesBoard } from "@/lib/board";
import { isFurtherMessage, isWebCitation, type MessageCitation } from "@/lib/further";

import { BoardFrame } from "./board-frame";

/** Message fixe « professeur indisponible », dans toutes les langues : affiché en rouge. */
const UNAVAILABLE = new Set(LOCALES.map((l) => getMessages(l).tutor.unavailable));

/** Passages du cours cités (les pages web sont affichées à part). */
function courseSources(citations: readonly MessageCitation[]): string {
  // Un document une seule fois, suivi de ses pages : « cours.pdf, p. 2, 3, 4 ».
  const pages = new Map<string, number[]>();
  for (const c of citations) {
    if (isWebCitation(c)) continue;
    const list = pages.get(c.documentTitle) ?? [];
    if (c.page && !list.includes(c.page)) list.push(c.page);
    pages.set(c.documentTitle, list);
  }
  return [...pages]
    .map(([title, list]) => (list.length ? `${title}, p. ${list.sort((a, b) => a - b).join(", ")}` : title))
    .join(" · ");
}

export async function MessageList({ messages }: { messages: TutorMessage[] }) {
  const t = await getT();
  return (
    <ol className="flex flex-col gap-3">
      {messages.map((m) =>
        m.role === "user" ? (
          <li key={m.id} className="max-w-[85%] self-end whitespace-pre-wrap rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-white">
            {m.content}
          </li>
        ) : isFurtherMessage(m) ? (
          // « Pour aller plus loin » : suite de l'explication, avec ses sources web.
          <li key={m.id} className="flex w-full flex-col gap-2 self-stretch">
            <div className="flex items-center gap-2">
              <Image src="/prof-atumi.svg" alt="" width={28} height={28} className="shrink-0" />
              <span className="text-sm font-semibold text-primary-strong dark:text-lavande">{t.tutor.name}</span>
            </div>
            <div className="flex flex-col gap-3 rounded-2xl border border-accent/50 bg-white p-4 shadow-sm shadow-accent/10 dark:bg-neutral-900">
              <SynthesisContent markdown={m.content} />
              <div className="flex flex-col gap-1 border-t border-neutral-200 pt-3 dark:border-neutral-800">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{t.tutor.further.webSources}</p>
                <ul className="flex flex-col gap-1 text-sm">
                  {m.citations.filter(isWebCitation).map((c) => (
                    <li key={c.url}>
                      <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-primary underline dark:text-lavande">
                        {c.title}
                      </a>
                      <span className="text-xs text-neutral-500"> · {new URL(c.url).hostname.replace(/^www\./, "")}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-neutral-500">{t.tutor.further.check}</p>
              </div>
              <ShareActions title={t.tutor.name} markdown={m.content} />
            </div>
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
                      {t.tutor.sources} : {courseSources(m.citations)}
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
                  {t.tutor.sources} : {courseSources(m.citations)}
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
