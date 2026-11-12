"use client";

import { useEffect, useState } from "react";

import { useT } from "@/i18n/client";
import { OFFLINE_SECTION_ORDER, offlineSection, PAGES_CACHE, type OfflineSection } from "@/lib/offline";

interface SavedPage {
  href: string;
  title: string;
  section: OfflineSection;
}

function pageTitle(html: string, fallback: string): string {
  const match = html.match(/<title>([^<]*)<\/title>/i);
  const raw = match?.[1]?.trim();
  if (!raw) return fallback;
  const text = new DOMParser().parseFromString(raw, "text/html").documentElement.textContent ?? raw;
  return text.replace(/\s·\sATUMI$/, "").trim() || fallback;
}

async function readSavedPages(): Promise<SavedPage[]> {
  if (typeof caches === "undefined") return [];
  const cache = await caches.open(PAGES_CACHE);
  const requests = await cache.keys();
  const pages: SavedPage[] = [];
  for (const request of [...requests].reverse()) {
    const url = new URL(request.url);
    const section = offlineSection(url.pathname);
    if (!section) continue;
    const response = await cache.match(request);
    const html = response ? await response.text() : "";
    pages.push({ href: url.pathname + url.search, title: pageTitle(html, url.pathname), section });
  }
  return pages;
}

/** Liste des pages gardées sur cet appareil, rangées par partie d'ATUMI. */
export function SavedPages() {
  const t = useT();
  const [pages, setPages] = useState<SavedPage[] | null>(null);

  useEffect(() => {
    readSavedPages()
      .then(setPages)
      .catch(() => setPages([]));
  }, []);

  if (pages === null) return null;
  if (pages.length === 0) return <p className="text-sm text-neutral-600 dark:text-neutral-300">{t.offline.savedEmpty}</p>;

  return (
    <div className="flex flex-col gap-4">
      {OFFLINE_SECTION_ORDER.map((section) => {
        const items = pages.filter((p) => p.section === section);
        if (items.length === 0) return null;
        return (
          <section key={section} className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-accent-text dark:text-accent">
              {t.offline.sections[section]}
            </h3>
            <ul className="flex flex-col gap-2">
              {items.map((page) => (
                <li key={page.href}>
                  {/* Lien classique : la page est servie par la copie gardée, sans appel au serveur. */}
                  <a
                    href={page.href}
                    className="block rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-medium hover:border-primary dark:border-neutral-800 dark:bg-neutral-950"
                  >
                    {page.title}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
