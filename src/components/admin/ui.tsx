import type { ReactNode } from "react";

import { getT } from "@/i18n/server";
import { ADMIN_PERIODS, type AdminPeriod } from "@/server/admin/schemas";

/** Briques communes des pages d'administration. */

export function PageHeader({ title, intro, children }: { title: string; intro: string; children?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-300">{intro}</p>
      </div>
      {children}
    </header>
  );
}

export function Card({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-2">
        <h2 className="text-base font-semibold">{title}</h2>
        {action}
      </div>
      <div className="flex flex-col gap-3 px-4 pb-4">{children}</div>
    </section>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "warn" }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <span className="text-sm text-neutral-600 dark:text-neutral-300">{label}</span>
      <strong className={`text-2xl font-bold ${tone === "warn" ? "text-orange-700 dark:text-orange-400" : ""}`}>{value}</strong>
      {hint ? <span className="text-xs text-neutral-600 dark:text-neutral-400">{hint}</span> : null}
    </div>
  );
}

/** Barre horizontale avec libellé et valeur (répartitions). */
export function Bar({ label, value, total, display }: { label: string; value: number; total: number; display: string }) {
  const percent = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="flex flex-col gap-1 text-sm">
      <span className="flex justify-between gap-2">
        <span>{label}</span>
        <strong>{display}</strong>
      </span>
      <span className="h-2 overflow-hidden rounded bg-neutral-200 dark:bg-neutral-800" aria-hidden="true">
        <span className="block h-full rounded bg-primary" style={{ width: `${percent}%` }} />
      </span>
    </div>
  );
}

/** Tableau large : défile horizontalement dans sa carte sur téléphone. */
export function Table({ head, children }: { head: readonly string[]; children: ReactNode }) {
  return (
    <div className="-mx-4 overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">
        <thead>
          <tr className="bg-background text-neutral-600 dark:bg-neutral-950 dark:text-neutral-300">
            {head.map((h) => (
              <th key={h} scope="col" className="px-4 py-2 font-semibold whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="[&>tr]:border-t [&>tr]:border-neutral-100 dark:[&>tr]:border-neutral-800 [&_td]:px-4 [&_td]:py-2.5 [&_td]:align-top">
          {children}
        </tbody>
      </table>
    </div>
  );
}

/** Choix de la période (?jours=7|30|90), formulaire GET sans JavaScript. */
export async function PeriodPicker({ period, extra }: { period: AdminPeriod; extra?: Record<string, string> }) {
  const t = await getT();
  return (
    <form className="flex items-center gap-2 text-sm">
      {Object.entries(extra ?? {}).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <label className="flex items-center gap-2">
        <span className="text-neutral-600 dark:text-neutral-300">{t.admin.period}</span>
        <select
          name="jours"
          defaultValue={period}
          className="rounded-lg border border-neutral-300 bg-white px-2 py-2 dark:border-neutral-700 dark:bg-neutral-900"
        >
          {ADMIN_PERIODS.map((p) => (
            <option key={p} value={p}>
              {t.admin.periods[p]}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" className="rounded-lg border border-neutral-300 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900">
        {t.admin.show}
      </button>
    </form>
  );
}

/** Message après une action (?ok=… ou ?erreur=…). */
export async function ActionNotice({ ok, error }: { ok?: unknown; error?: unknown }) {
  const t = await getT();
  const notices = t.admin.notices as Record<string, string>;
  const errors = t.admin.errors as Record<string, string>;
  if (typeof error === "string") {
    return (
      <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
        {errors[error] ?? t.admin.errors.unknown}
      </p>
    );
  }
  if (typeof ok === "string" && ok in notices) {
    return (
      <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800 dark:bg-green-950 dark:text-green-200">
        {notices[ok]}
      </p>
    );
  }
  return null;
}

// Classes partagées avec les formulaires client du back office (sans import serveur).
export { buttonClass, inputClass, secondaryButtonClass } from "./styles";
