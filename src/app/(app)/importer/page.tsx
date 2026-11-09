import type { Metadata } from "next";
import { Suspense } from "react";

import { ImportForm } from "@/components/courses/import-form";
import { getMessages } from "@/i18n/messages";
import { serverEnv } from "@/lib/env";
import { requireUserId } from "@/server/auth/session";
import { getAccess, listModules } from "@/server/courses/queries";

const t = getMessages("fr");

export const metadata: Metadata = { title: `${t.import.title} · ${t.app.name}` };

export default function ImportPage({ searchParams }: PageProps<"/importer">) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-bold">{t.import.title}</h1>
      <Suspense fallback={<p>{t.dashboard.loading}</p>}>
        <ImportLoader searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function ImportLoader({ searchParams }: { searchParams: PageProps<"/importer">["searchParams"] }) {
  const [userId, modules, access, query] = await Promise.all([requireUserId(), listModules(), getAccess(), searchParams]);
  const pick = (value: string | string[] | undefined) => (typeof value === "string" ? value : "");
  const moduleId = pick(query.module);
  const selected = modules.find((m) => m.id === moduleId);
  const chapterId = pick(query.chapitre);
  // Les photos sont lues par le modèle : proposées seulement si le service d'IA est configuré.
  const photosEnabled = Boolean(serverEnv().ANTHROPIC_API_KEY);

  return (
    <ImportForm
      userId={userId}
      modules={modules.map((m) => ({ id: m.id, name: m.name, chapters: m.chapters }))}
      initialModuleId={selected?.id ?? modules[0]?.id ?? ""}
      initialChapterId={selected?.chapters.some((c) => c.id === chapterId) ? chapterId : ""}
      firstImport={access.state === "trialNotStarted"}
      photosEnabled={photosEnabled}
    />
  );
}
