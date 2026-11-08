import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { z } from "zod";

import { CloseOnEscape } from "@/components/courses/close-on-escape";
import { DocumentViewer } from "@/components/courses/document-viewer";
import { getMessages } from "@/i18n/messages";
import { viewerKind } from "@/lib/document-view";
import { getDocumentFile } from "@/server/courses/queries";

const t = getMessages("fr");

export const metadata: Metadata = { title: `${t.courses.title} · ${t.app.name}` };

type Props = PageProps<"/cours/[moduleId]/document/[documentId]">;

/** Ouvre un document importé dans ATUMI ; « Fermer » ramène au module. */
export default function DocumentPage({ params }: Props) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-6">
      <Suspense fallback={<p>{t.dashboard.loading}</p>}>
        <DocumentDetail params={params} />
      </Suspense>
    </main>
  );
}

async function DocumentDetail({ params }: Pick<Props, "params">) {
  const { moduleId, documentId } = await params;
  const valid = z.uuid().safeParse(moduleId).success && z.uuid().safeParse(documentId).success;
  const file = valid ? await getDocumentFile(moduleId, documentId) : null;
  const backHref = valid ? `/cours/${moduleId}` : "/cours";

  if (!file) {
    return (
      <>
        <p className="text-neutral-600 dark:text-neutral-300">{t.viewer.notFound}</p>
        <Link href={backHref} className="text-sm text-primary dark:text-lavande">
          ← {t.courses.back}
        </Link>
      </>
    );
  }

  return (
    <>
      <CloseOnEscape href={backHref} />
      <header className="sticky top-0 z-10 -mx-4 flex items-center gap-3 border-b border-neutral-200 bg-background/95 px-4 py-3 backdrop-blur dark:border-neutral-800">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold">{file.title}</h1>
          <p className="truncate text-xs text-neutral-600 dark:text-neutral-300">
            {file.moduleName} · {t.courses.kinds[file.kind]}
          </p>
        </div>
        <a
          href={file.downloadUrl}
          className="shrink-0 rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium dark:border-neutral-700"
        >
          {t.viewer.download}
        </a>
        <Link href={backHref} className="shrink-0 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white">
          ✕ {t.viewer.close}
        </Link>
      </header>

      <DocumentViewer
        kind={viewerKind(file.mimeType)}
        url={file.viewUrl}
        title={file.title}
        labels={{ loading: t.viewer.loading, failed: t.viewer.failed, page: t.viewer.page }}
      />
    </>
  );
}
