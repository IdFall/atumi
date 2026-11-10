import Link from "next/link";
import type { ReactNode } from "react";

import { fill } from "@/i18n/format";
import { DATE_LOCALES } from "@/i18n/messages";
import { getLocale, getT } from "@/i18n/server";
import { excerpt } from "@/lib/search";
import { isEmpty, type SearchResults } from "@/server/search/types";

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">{title}</h2>
      <ul className="flex flex-col gap-2">{children}</ul>
    </section>
  );
}

const ITEM = "block rounded-xl border border-neutral-200 bg-white p-3 hover:border-primary dark:border-neutral-800 dark:bg-neutral-950";

/** Résultats groupés (contenu, modules, chapitres, documents, agenda) et lien vers le Prof NEO. */
export async function SearchResultsView({ results: r, q }: { results: SearchResults; q: string }) {
  const s = (await getT()).search;
  const tag = DATE_LOCALES[await getLocale()];
  const askTutor = (
    <Link
      href={`/professeur?q=${encodeURIComponent(q)}`}
      className="flex flex-col gap-0.5 rounded-xl border border-primary/30 bg-primary-soft/50 p-4 dark:bg-primary-strong/15"
    >
      <span className="font-semibold text-primary-strong dark:text-lavande">{s.askTutor} →</span>
      <span className="text-sm text-neutral-700 dark:text-neutral-300">{fill(s.askTutorHint, { q })}</span>
    </Link>
  );

  return (
    <>
      {isEmpty(r) ? (
        <p className="rounded-xl border border-dashed border-neutral-300 p-5 text-center text-neutral-600 dark:border-neutral-700 dark:text-neutral-300">
          {fill(s.none, { q })}
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          <h2 className="text-lg font-semibold">{fill(s.resultsFor, { q })}</h2>
          {r.passages.length ? (
            <Group title={s.groups.passages}>
              {r.passages.map((p) => (
                <li key={p.id}>
                  <Link href={`/cours/${p.moduleId}/document/${p.documentId}`} className={ITEM}>
                    <p className="text-sm font-semibold">
                      {p.documentTitle}
                      {p.page ? <span className="font-normal text-neutral-500"> · {fill(s.page, { page: p.page })}</span> : null}
                    </p>
                    <p className="text-sm text-neutral-700 dark:text-neutral-300">
                      {excerpt(p.content, q).map((part, i) =>
                        part.match ? (
                          <mark key={i} className="rounded bg-lavande/50 px-0.5 text-inherit dark:bg-primary/40">
                            {part.text}
                          </mark>
                        ) : (
                          <span key={i}>{part.text}</span>
                        ),
                      )}
                    </p>
                  </Link>
                </li>
              ))}
            </Group>
          ) : null}
          {r.modules.length ? (
            <Group title={s.groups.modules}>
              {r.modules.map((m) => (
                <li key={m.id}>
                  <Link href={`/cours/${m.id}`} className={`${ITEM} font-semibold`}>
                    {m.name}
                  </Link>
                </li>
              ))}
            </Group>
          ) : null}
          {r.chapters.length ? (
            <Group title={s.groups.chapters}>
              {r.chapters.map((c) => (
                <li key={c.id}>
                  <Link href={`/cours/${c.moduleId}`} className={ITEM}>
                    <span className="font-semibold">{c.title}</span>
                    {c.moduleName ? <span className="text-sm text-neutral-500"> · {c.moduleName}</span> : null}
                  </Link>
                </li>
              ))}
            </Group>
          ) : null}
          {r.documents.length ? (
            <Group title={s.groups.documents}>
              {r.documents.map((d) => (
                <li key={d.id}>
                  <Link href={`/cours/${d.moduleId}/document/${d.id}`} className={`${ITEM} font-semibold`}>
                    {d.title}
                  </Link>
                </li>
              ))}
            </Group>
          ) : null}
          {r.events.length ? (
            <Group title={s.groups.events}>
              {r.events.map((e) => (
                <li key={e.id}>
                  <Link href="/agenda" className={ITEM}>
                    <span className="font-semibold">{e.title}</span>
                    <span className="text-sm text-neutral-500">
                      {" "}
                      · {new Date(`${e.dueOn}T00:00:00Z`).toLocaleDateString(tag, { day: "numeric", month: "short", timeZone: "UTC" })}
                    </span>
                  </Link>
                </li>
              ))}
            </Group>
          ) : null}
        </div>
      )}
      {askTutor}
    </>
  );
}
