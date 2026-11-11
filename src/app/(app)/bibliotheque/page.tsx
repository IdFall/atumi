import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { DeleteBook, UploadBook } from "@/components/library/library-actions";
import { formatBytes, LIBRARY_MAX_FILE_BYTES } from "@/config/library";
import { fill } from "@/i18n/format";
import { DATE_LOCALES } from "@/i18n/messages";
import { getLocale, getT } from "@/i18n/server";
import { getCurrentUser } from "@/server/auth/session";
import { getLibrary } from "@/server/library/queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: `${t.library.title} · ${t.app.name}` };
}

/** Ma bibliothèque : livres offerts par ATUMI et livres PDF de l'élève (abonnés). */
export default async function LibraryPage() {
  const t = await getT();
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">{t.library.title}</h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-300">{t.library.intro}</p>
      </header>
      <Suspense fallback={<p>{t.dashboard.loading}</p>}>
        <LibraryContent />
      </Suspense>
    </main>
  );
}

const BOOK_ICON = "M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2zM4 19V5M8 7h6";
const LINK = "rounded-lg px-3 py-1.5 text-sm font-semibold";

function BookIcon({ tone }: { tone: "offered" | "mine" }) {
  return (
    <span
      aria-hidden="true"
      className={`flex h-14 w-11 shrink-0 items-center justify-center rounded-md shadow-sm ${
        tone === "offered" ? "bg-gradient-to-br from-primary to-electrique text-white" : "bg-primary-soft text-primary-strong dark:bg-primary-strong/30 dark:text-lavande"
      }`}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d={BOOK_ICON} />
      </svg>
    </span>
  );
}

async function LibraryContent() {
  const [t, locale, user, library] = await Promise.all([getT(), getLocale(), getCurrentUser(), getLibrary()]);
  const l = t.library;
  const tag = DATE_LOCALES[locale];

  if (!library.rights.read) {
    return (
      <section className="flex flex-col items-center gap-3 rounded-2xl border border-primary/20 bg-white p-6 text-center dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="text-lg font-bold">{l.lockedTitle}</h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-300">{l.locked}</p>
        <Link href="/abonnement" className="rounded-xl bg-primary px-5 py-3 font-semibold text-white">
          {l.subscribe}
        </Link>
      </section>
    );
  }

  const freeBytes = library.bytesLimit === null ? null : Math.max(library.bytesLimit - library.usedBytes, 0);
  const percent = library.bytesLimit ? Math.min(100, Math.round((library.usedBytes / library.bytesLimit) * 100)) : 0;

  return (
    <>
      {!library.rights.download ? (
        <p className="rounded-xl border border-accent/30 bg-accent/10 p-3 text-sm">
          {l.trialNotice}{" "}
          <Link href="/abonnement" className="font-semibold text-primary-strong underline dark:text-lavande">
            {l.subscribe}
          </Link>
        </p>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">{l.offeredTitle}</h2>
        <ul className="flex flex-col gap-2">
          {library.defaults.map((book) => (
            <li key={book.id} className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900">
              <BookIcon tone="offered" />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="font-semibold">{book.title}</span>
                <span className="text-xs text-neutral-600 dark:text-neutral-300">
                  {book.author} · {fill(l.pages, { n: String(book.pages) })} · {l.offeredBy}
                </span>
              </div>
              <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
                <Link href={`/bibliotheque/${book.id}`} className={`${LINK} bg-primary text-white`}>
                  {l.read}
                </Link>
                {library.rights.download ? (
                  <a href={`/api/bibliotheque/${book.id}?telecharger=1`} className={`${LINK} text-primary-strong dark:text-lavande`}>
                    {l.download}
                  </a>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {library.rights.download ? (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-base font-semibold">{l.mineTitle}</h2>
            <span className="text-xs text-neutral-600 dark:text-neutral-300">
              {library.bytesLimit === null
                ? fill(l.spaceUnlimited, { used: formatBytes(library.usedBytes, tag) })
                : fill(l.space, { used: formatBytes(library.usedBytes, tag), total: formatBytes(library.bytesLimit, tag) })}
            </span>
          </div>
          {library.bytesLimit ? (
            <div className="h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800" aria-hidden="true">
              <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent" style={{ width: `${percent}%` }} />
            </div>
          ) : null}
          {library.rights.upload ? (
            <UploadBook userId={user.id} freeBytes={freeBytes} maxLabel={formatBytes(LIBRARY_MAX_FILE_BYTES, tag)} />
          ) : null}
          {library.books.length === 0 ? (
            <p className="text-sm text-neutral-600 dark:text-neutral-300">{l.empty}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {library.books.map((book) => (
                <li key={book.id} className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900">
                  <BookIcon tone="mine" />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-semibold">{book.title}</span>
                    <span className="text-xs text-neutral-600 dark:text-neutral-300">{formatBytes(book.sizeBytes, tag)}</span>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center">
                    <Link href={`/bibliotheque/${book.id}`} className={`${LINK} bg-primary text-white`}>
                      {l.read}
                    </Link>
                    <a href={`/api/bibliotheque/${book.id}?telecharger=1`} className={`${LINK} text-primary-strong dark:text-lavande`}>
                      {l.download}
                    </a>
                    <DeleteBook id={book.id} name={book.title} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </>
  );
}
