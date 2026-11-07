import Image from "next/image";

import { ShareActions } from "@/components/study/share-actions";
import { SynthesisContent } from "@/components/study/synthesis-content";
import { getMessages } from "@/i18n/messages";
import type { TutorMessage } from "@/server/tutor/queries";

const t = getMessages("fr");

export function MessageList({ messages }: { messages: TutorMessage[] }) {
  return (
    <ol className="flex flex-col gap-3">
      {messages.map((m) =>
        m.role === "user" ? (
          <li key={m.id} className="max-w-[85%] self-end whitespace-pre-wrap rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-white">
            {m.content}
          </li>
        ) : (
          <li key={m.id} className="flex max-w-[92%] items-end gap-2 self-start">
            <Image src="/prof-atumi.svg" alt="" width={28} height={28} className="shrink-0" />
            <div className="flex min-w-0 flex-col gap-2 rounded-2xl rounded-bl-sm border border-neutral-200 bg-white px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900">
              <SynthesisContent markdown={m.content} />
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
