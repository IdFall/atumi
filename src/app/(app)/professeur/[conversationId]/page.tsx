import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { TutorComposer } from "@/components/tutor/composer";
import { EraseButton } from "@/components/tutor/erase-button";
import { MessageList } from "@/components/tutor/message-list";
import { TutorHeader } from "@/components/tutor/tutor-header";
import { getMessages } from "@/i18n/messages";
import { getConversation, getTutorSettings } from "@/server/tutor/queries";

const t = getMessages("fr");

export const metadata: Metadata = { title: `${t.tutor.name} · ${t.app.name}` };

type Props = PageProps<"/professeur/[conversationId]">;

export default function ConversationPage({ params }: Props) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-5 px-4 py-6">
      <Suspense fallback={<p>{t.dashboard.loading}</p>}>
        <ConversationView params={params} />
      </Suspense>
    </main>
  );
}

async function ConversationView({ params }: { params: Props["params"] }) {
  const { conversationId } = await params;
  const [conversation, settings] = await Promise.all([getConversation(conversationId), getTutorSettings()]);
  if (!conversation) {
    return (
      <p className="text-neutral-600 dark:text-neutral-300">
        <Link href="/professeur" className="text-primary dark:text-lavande">
          {t.tutor.newConversation}
        </Link>
      </p>
    );
  }
  const scopeQuery =
    conversation.moduleId && conversation.chapterId ? `&module=${conversation.moduleId}&chapitre=${conversation.chapterId}` : "";

  return (
    <>
      <TutorHeader mode={conversation.mode} language={settings.language} languages={settings.languages} scopeQuery={scopeQuery} />
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-semibold text-primary-strong dark:text-lavande">
          {t.tutor.modes[conversation.mode]}
          {conversation.chapterTitle ? ` · ${conversation.chapterTitle}` : ""}
        </span>
        <Link href={`/professeur?mode=${conversation.mode === "approfondir" ? "expliquer" : conversation.mode}${scopeQuery}`} className="text-primary dark:text-lavande">
          {t.tutor.newConversation}
        </Link>
      </div>
      {conversation.mode === "decouvrir" ? (
        <p className="rounded-lg bg-neutral-100 p-3 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">{t.tutor.discoverNotice}</p>
      ) : null}
      <MessageList messages={conversation.messages} />
      <TutorComposer
        conversationId={conversation.id}
        mode={conversation.mode}
        moduleId={conversation.moduleId}
        chapterId={conversation.chapterId}
        messagesLeft={settings.hasAccess ? settings.messagesLeft : 0}
        messageLimit={settings.messageLimit}
        quickReplies={conversation.mode === "expliquer" || conversation.mode === "approfondir" || conversation.mode === "decouvrir"}
      />
      <div className="flex justify-end">
        <EraseButton conversationId={conversation.id} redirectAfter />
      </div>
    </>
  );
}
