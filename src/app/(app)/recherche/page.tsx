import type { Metadata } from "next";
import { Suspense } from "react";

import { SearchResultsView } from "@/components/search/results";
import { getT } from "@/i18n/server";
import { cleanQuery } from "@/lib/search";
import { searchCourses } from "@/server/search/queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: `${t.search.title} · ${t.app.name}` };
}

/** Recherche dans tous les cours de l'élève (sans appel au modèle, hors forfait). */
export default async function SearchPage({ searchParams }: PageProps<"/recherche">) {
  const t = await getT();
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-5 px-4 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">{t.search.title}</h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-300">{t.search.intro}</p>
      </header>
      <Suspense fallback={<p>{t.dashboard.loading}</p>}>
        <SearchLoader searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function SearchLoader({ searchParams }: { searchParams: PageProps<"/recherche">["searchParams"] }) {
  const t = await getT();
  const s = t.search;
  const raw = (await searchParams).q;
  const typed = typeof raw === "string" ? raw : "";
  const q = cleanQuery(typed);

  const form = (
    <form action="/recherche" role="search" className="flex flex-col gap-1">
      <label htmlFor="q" className="text-sm font-medium">
        {s.label}
      </label>
      <div className="flex gap-2">
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={typed}
          autoFocus={!q}
          maxLength={100}
          placeholder={s.placeholder}
          className="min-w-0 flex-1 rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-base outline-none focus:ring-2 focus:ring-primary dark:border-neutral-700 dark:bg-neutral-950"
        />
        <button type="submit" className="rounded-xl bg-primary px-4 py-2.5 font-semibold text-white">
          {s.submit}
        </button>
      </div>
      {typed && !q ? <p className="text-sm text-orange-700 dark:text-orange-400">{s.tooShort}</p> : null}
      <p className="text-xs text-neutral-500">{s.tips}</p>
    </form>
  );
  if (!q) return form;

  const r = await searchCourses(q);
  return (
    <>
      {form}
      <SearchResultsView results={r} q={q} />
    </>
  );
}
