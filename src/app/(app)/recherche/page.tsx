import type { Metadata } from "next";
import { Suspense } from "react";

import Link from "next/link";

import { ResearchPanel } from "@/components/search/research-panel";
import { SearchResultsView } from "@/components/search/results";
import { Toolbox } from "@/components/tools/toolbox";
import { getT } from "@/i18n/server";
import { serverEnv } from "@/lib/env";
import { cleanQuery } from "@/lib/search";
import { getResearchQuota, listResearch } from "@/server/research/queries";
import { searchCourses } from "@/server/search/queries";

const TABS = ["cours", "web", "outils"] as const;
type Tab = (typeof TABS)[number];

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: `${t.search.title} · ${t.app.name}` };
}

/**
 * Module Recherche, trois onglets : dans mes cours (sans IA, hors forfait),
 * sur le web (IA avec sources, limité par jour), boîte à outils (sans IA).
 */
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
  const query = await searchParams;
  const tab: Tab = TABS.find((k) => k === query.onglet) ?? "cours";

  const tabs = (
    <nav aria-label={s.title} className="grid grid-cols-3 gap-1 rounded-xl bg-neutral-100 p-1 dark:bg-neutral-900">
      {TABS.map((key) => (
        <Link
          key={key}
          href={key === "cours" ? "/recherche" : `/recherche?onglet=${key}`}
          aria-current={tab === key ? "page" : undefined}
          className={`rounded-lg px-2 py-2 text-center text-sm font-semibold ${
            tab === key ? "bg-white text-primary shadow-sm dark:bg-neutral-800 dark:text-lavande" : "text-neutral-600 dark:text-neutral-300"
          }`}
        >
          {s.tabs[key]}
        </Link>
      ))}
    </nav>
  );

  if (tab === "web") {
    const [items, quota] = await Promise.all([listResearch(), getResearchQuota()]);
    return (
      <>
        {tabs}
        <ResearchPanel items={items} quota={quota} aiEnabled={Boolean(serverEnv().ANTHROPIC_API_KEY)} />
      </>
    );
  }
  if (tab === "outils") {
    return (
      <>
        {tabs}
        <Toolbox />
      </>
    );
  }

  const raw = query.q;
  const typed = typeof raw === "string" ? raw : "";
  const q = cleanQuery(typed);

  const form = (
    <form action="/recherche" role="search" className="flex flex-col gap-1">
      <p className="mb-1 text-sm text-neutral-600 dark:text-neutral-300">{s.coursesIntro}</p>
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
  if (!q) {
    return (
      <>
        {tabs}
        {form}
      </>
    );
  }

  const r = await searchCourses(q);
  return (
    <>
      {tabs}
      {form}
      <SearchResultsView results={r} q={q} />
    </>
  );
}
