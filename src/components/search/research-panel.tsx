import { ShareActions } from "@/components/study/share-actions";
import { SynthesisContent } from "@/components/study/synthesis-content";
import { fill } from "@/i18n/format";
import { getT } from "@/i18n/server";
import { deleteResearchAction } from "@/server/research/actions";
import type { ResearchItem, ResearchQuota } from "@/server/research/queries";

import { ResearchForm } from "./research-form";

/** Onglet « Web (IA) » : question libre, limite du jour, dernières réponses avec leurs sources. */
export async function ResearchPanel({ items, quota, aiEnabled }: { items: ResearchItem[]; quota: ResearchQuota; aiEnabled: boolean }) {
  const t = await getT();
  const r = t.research;
  const blocked = !aiEnabled || !quota.hasAccess || quota.remaining === 0;
  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-neutral-600 dark:text-neutral-300">{r.intro}</p>
      {!aiEnabled ? (
        <p className="rounded-lg bg-red-50 p-3 text-sm font-medium text-red-700 dark:bg-red-950 dark:text-red-300">{r.unavailable}</p>
      ) : !quota.hasAccess ? (
        <p className="rounded-lg bg-orange-50 p-3 text-sm text-orange-900 dark:bg-orange-950 dark:text-orange-100">{r.errors.noAccess}</p>
      ) : (
        <p className="text-xs text-neutral-500">
          {quota.limit === null ? r.unlimited : fill(r.remaining, { count: quota.remaining ?? 0, limit: quota.limit })}
        </p>
      )}
      <ResearchForm disabled={blocked} />

      {items.length ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">{r.history}</h2>
          {items.map((item) => (
            <article key={item.id} className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
              <p className="font-semibold">{item.question}</p>
              <SynthesisContent markdown={item.answer ?? ""} />
              {item.sources.length ? (
                <div className="flex flex-col gap-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{r.sources}</p>
                  <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm">
                    {item.sources.map((s) => (
                      <li key={s.url}>
                        <a href={s.url} target="_blank" rel="noopener noreferrer nofollow" className="text-primary underline-offset-2 hover:underline dark:text-lavande">
                          {s.title}
                        </a>
                        <span className="text-neutral-500"> · {new URL(s.url).hostname.replace(/^www\./, "")}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              ) : null}
              <div className="flex flex-wrap items-center gap-2">
                <ShareActions
                  title={item.question}
                  markdown={`${item.answer ?? ""}${item.sources.length ? `\n\n${r.sources} :\n${item.sources.map((s) => `- ${s.title} : ${s.url}`).join("\n")}` : ""}`}
                />
                <form action={deleteResearchAction}>
                  <input type="hidden" name="id" value={item.id} />
                  <button type="submit" className="min-h-10 rounded-lg px-3 text-sm font-medium text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950">
                    {r.delete}
                  </button>
                </form>
              </div>
            </article>
          ))}
        </section>
      ) : null}
    </div>
  );
}
