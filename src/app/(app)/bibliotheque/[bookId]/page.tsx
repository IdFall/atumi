import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { CloseOnEscape } from "@/components/courses/close-on-escape";
import { DocumentViewer } from "@/components/courses/document-viewer";
import { defaultBook } from "@/config/library";
import { getT } from "@/i18n/server";
import { getAccess } from "@/server/courses/queries";
import { getUserBook, libraryRights } from "@/server/library/queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: `${t.library.title} · ${t.app.name}` };
}

type Props = PageProps<"/bibliotheque/[bookId]">;

/** Lecture d'un livre dans ATUMI (pages dessinées dans la page, sans lecteur du téléphone). */
export default async function BookPage({ params }: Props) {
  const t = await getT();
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-6">
      <Suspense fallback={<p>{t.dashboard.loading}</p>}>
        <BookReader params={params} />
      </Suspense>
    </main>
  );
}

async function BookReader({ params }: { params: Props["params"] }) {
  const [{ bookId }, t] = await Promise.all([params, getT()]);
  const l = t.library;
  const rights = libraryRights(await getAccess(), false);
  const offered = defaultBook(bookId);
  const mine = offered || !/^[0-9a-f-]{36}$/.test(bookId) ? null : await getUserBook(bookId);
  const title = offered?.title ?? mine?.title;

  if (!rights.read || !title) {
    return (
      <>
        <Link href="/bibliotheque" className="text-sm font-medium text-primary-strong dark:text-lavande">
          {l.back}
        </Link>
        <p className="rounded-xl bg-neutral-100 p-4 text-sm dark:bg-neutral-800">{rights.read ? l.notFound : l.locked}</p>
      </>
    );
  }

  return (
    <>
      <CloseOnEscape href="/bibliotheque" />
      <header className="flex flex-col gap-2">
        <Link href="/bibliotheque" className="text-sm font-medium text-primary-strong dark:text-lavande">
          {l.back}
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="min-w-0 flex-1 text-xl font-bold">{title}</h1>
          {rights.download ? (
            <a href={`/api/bibliotheque/${bookId}?telecharger=1`} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white">
              {l.download}
            </a>
          ) : null}
        </div>
        {!rights.download ? <p className="text-xs text-neutral-600 dark:text-neutral-300">{l.readOnly}</p> : null}
      </header>
      <DocumentViewer
        kind="pdf"
        url={`/api/bibliotheque/${bookId}`}
        title={title}
        labels={{ loading: t.viewer.loading, failed: t.viewer.failed, page: t.viewer.page }}
      />
    </>
  );
}
