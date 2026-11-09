import type { Metadata } from "next";
import { Suspense } from "react";

import { InlineCreateForm } from "@/components/courses/inline-create-form";
import { ModuleCard } from "@/components/courses/module-card";
import { PendingRefresh } from "@/components/courses/pending-refresh";
import { getMessages } from "@/i18n/messages";
import { createModuleAction } from "@/server/courses/actions";
import { listModules } from "@/server/courses/queries";

const t = getMessages("fr");

export const metadata: Metadata = { title: `${t.courses.title} · ${t.app.name}` };

export default function CoursesPage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-bold">{t.courses.title}</h1>
      <Suspense fallback={<p>{t.dashboard.loading}</p>}>
        <ModuleList />
      </Suspense>
      <InlineCreateForm action={createModuleAction} fieldName="name" label={t.courses.newModule} placeholder={t.courses.newModulePlaceholder} />
    </main>
  );
}

async function ModuleList() {
  const modules = await listModules();
  if (modules.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-neutral-300 p-6 text-center text-neutral-600 dark:border-neutral-700 dark:text-neutral-300">
        {t.courses.empty}
      </p>
    );
  }
  return (
    <>
      <PendingRefresh active={modules.some((m) => m.next.kind === "reading")} />
      <ul className="flex flex-col gap-3">
        {modules.map((m) => (
          <li key={m.id}>
            <ModuleCard module={m} />
          </li>
        ))}
      </ul>
    </>
  );
}
