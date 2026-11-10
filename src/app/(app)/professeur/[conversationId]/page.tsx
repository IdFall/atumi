import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { CallButton } from "@/components/tutor/call-button";
import { TutorComposer } from "@/components/tutor/composer";
import { EraseButton } from "@/components/tutor/erase-button";
import { FurtherButton } from "@/components/tutor/further-button";
import { MessageList } from "@/components/tutor/message-list";
import { TutorHeader } from "@/components/tutor/tutor-header";
import { getT } from "@/i18n/server";
import { canExploreFurther } from "@/lib/further";
import { serverEnv } from "@/lib/env";
import { getCallSettings } from "@/server/calls/queries";
import { getConversation, getTutorSettings } from "@/server/tutor/queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: `${t.tutor.name} · ${t.app.name}` };
}

type Props = PageProps<"/professeur/[conversationId]">;

export default async function ConversationPage({ params }: Props) {
  const t = await getT();
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-5 px-4 py-6">
      <Suspense fallback={<p>{t.dashboard.loading}</p>}>
        <ConversationView params={params} />
      </Suspense>
    </main>
  );
}

async function ConversationView({ params }: { params: Props["params"] }) {
  const t = await getT();
  const { conversationId } = await params;
  const [conversation, settings, call] = await Promise.all([getConversation(conversationId), getTutorSettings(), getCallSettings()]);
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
      <CallButton
        conversationId={conversation.id}
        mode={conversation.mode}
        moduleId={conversation.moduleId}
        chapterId={conversation.chapterId}
        available={call.available}
        hasAccess={call.hasAccess}
        secondsLeft={call.secondsLeft}
      />
      <MessageList messages={conversation.messages} />
      {serverEnv().ANTHROPIC_API_KEY && settings.hasAccess && canExploreFurther(conversation.mode, conversation.messages) ? (
        <FurtherButton conversationId={conversation.id} />
      ) : null}
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
