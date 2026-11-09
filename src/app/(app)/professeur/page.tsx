import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { TutorComposer } from "@/components/tutor/composer";
import { DeepenButton } from "@/components/tutor/deepen-button";
import { EraseButton } from "@/components/tutor/erase-button";
import { TutorHeader } from "@/components/tutor/tutor-header";
import { getMessages } from "@/i18n/messages";
import type { TutorMode } from "@/server/ai/prompts";
import { getChapterScope, getTutorSettings, listConversations } from "@/server/tutor/queries";

const t = getMessages("fr");

export const metadata: Metadata = { title: `${t.tutor.name} · ${t.app.name}` };

const MODES: readonly TutorMode[] = ["expliquer", "approfondir", "exercer", "decouvrir"];

export default function TutorPage({ searchParams }: PageProps<"/professeur">) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-5 px-4 py-6">
      <Suspense fallback={<p>{t.dashboard.loading}</p>}>
        <NewConversation searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function NewConversation({ searchParams }: { searchParams: PageProps<"/professeur">["searchParams"] }) {
  const query = await searchParams;
  const pick = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");
  const mode = (MODES as readonly string[]).includes(pick(query.mode)) ? (pick(query.mode) as TutorMode) : "expliquer";

  const [settings, recent, scope] = await Promise.all([
    getTutorSettings(),
    listConversations(),
    pick(query.module) && pick(query.chapitre) ? getChapterScope(pick(query.module), pick(query.chapitre)) : null,
  ]);
  const scopeQuery = scope ? `&module=${scope.moduleId}&chapitre=${scope.chapterId}` : "";
  const scoped = mode !== "decouvrir" && scope;

  return (
    <>
      <TutorHeader mode={mode} language={settings.language} languages={settings.languages} scopeQuery={scopeQuery} />

      <p className="text-sm text-neutral-600 dark:text-neutral-300">{t.tutor.intro[mode]}</p>
      {mode === "decouvrir" ? (
        <p className="rounded-lg bg-neutral-100 p-3 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">{t.tutor.discoverNotice}</p>
      ) : (
        <p className="text-sm">
          <span className="text-neutral-500">{t.tutor.scope} : </span>
          <strong>{scoped ? scoped.title : t.tutor.allCourses}</strong>
        </p>
      )}

      {scoped && mode === "expliquer" && settings.messagesLeft !== 0 ? (
        <DeepenButton moduleId={scoped.moduleId} chapterId={scoped.chapterId} />
      ) : null}

      <TutorComposer
        conversationId={null}
        mode={mode}
        moduleId={scoped ? scoped.moduleId : null}
        chapterId={scoped ? scoped.chapterId : null}
        messagesLeft={settings.hasAccess ? settings.messagesLeft : 0}
        messageLimit={settings.messageLimit}
        quickReplies={false}
      />

      {recent.length > 0 ? (
        <section className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-base font-semibold">{t.tutor.recent}</h2>
            <EraseButton />
          </div>
          <ul className="flex flex-col gap-2">
            {recent.map((c) => (
              <li
                key={c.id}
                className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm dark:border-neutral-800 dark:bg-neutral-900"
              >
                <Link href={`/professeur/${c.id}`} className="flex min-w-0 flex-1 flex-col">
                  <span className="text-xs font-semibold text-primary-strong dark:text-lavande">{t.tutor.modes[c.mode]}</span>
                  <span className="truncate">{c.title}</span>
                </Link>
                <EraseButton conversationId={c.id} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
