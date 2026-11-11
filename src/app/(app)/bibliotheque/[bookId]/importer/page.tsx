import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { ImportForm } from "@/components/courses/import-form";
import { defaultBook } from "@/config/library";
import { getT } from "@/i18n/server";
import { requireUserId } from "@/server/auth/session";
import { getAccess, listModules } from "@/server/courses/queries";
import { getUserBook, libraryRights } from "@/server/library/queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: `${t.import.fromLibraryTitle} · ${t.app.name}` };
}

type Props = PageProps<"/bibliotheque/[bookId]/importer">;

/** Importer un livre de « Ma bibliothèque » dans « Mes cours » (synthèse, quiz, Prof NEO). */
export default async function ImportBookPage({ params }: Props) {
  const t = await getT();
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-8">
      <Suspense fallback={<p>{t.dashboard.loading}</p>}>
        <ImportBook params={params} />
      </Suspense>
    </main>
  );
}

async function ImportBook({ params }: { params: Props["params"] }) {
  const [{ bookId }, t, userId, modules, access] = await Promise.all([params, getT(), requireUserId(), listModules(), getAccess()]);
  const rights = libraryRights(access, false);
  const offered = defaultBook(bookId);
  const mine = offered || !/^[0-9a-f-]{36}$/.test(bookId) ? null : await getUserBook(bookId);
  const title = offered?.title ?? mine?.title;
  const back = (
    <Link href={`/bibliotheque/${bookId}`} className="text-sm font-medium text-primary-strong dark:text-lavande">
      {t.library.back}
    </Link>
  );

  if (!rights.read || !title) {
    return (
      <>
        {back}
        <p className="rounded-xl bg-neutral-100 p-4 text-sm dark:bg-neutral-800">{rights.read ? t.library.notFound : t.library.locked}</p>
      </>
    );
  }

  return (
    <>
      <header className="flex flex-col gap-2">
        {back}
        <h1 className="text-2xl font-bold">{t.import.fromLibraryTitle}</h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-300">{t.import.fromLibraryIntro}</p>
      </header>
      <ImportForm
        userId={userId}
        modules={modules.map((m) => ({ id: m.id, name: m.name, chapters: m.chapters }))}
        initialModuleId={modules[0]?.id ?? ""}
        initialChapterId=""
        firstImport={access.state === "trialNotStarted"}
        photosEnabled={false}
        book={{ id: bookId, title }}
      />
    </>
  );
}
