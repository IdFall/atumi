import Link from "next/link";
import { Suspense } from "react";

import { ActionNotice, PageHeader, secondaryButtonClass } from "@/components/admin/ui";
import { fill } from "@/i18n/format";
import { getLocale, getT } from "@/i18n/server";
import { adminFormat } from "@/lib/admin-format";
import { setSupportStatusAction } from "@/server/admin/actions";
import { listSupportRequests, type SupportStatus } from "@/server/admin/queries";

const FILTERS = ["nouvelle", "traitee", "all"] as const;
type Filter = (typeof FILTERS)[number];

/** Messages écrits à l'équipe depuis le centre d'aide. */
export default async function AdminMessagesPage({ searchParams }: PageProps<"/admin/messages">) {
  const t = await getT();
  const params = await searchParams;
  const filter: Filter = FILTERS.find((x) => x === params.etat) ?? "nouvelle";
  return (
    <>
      <PageHeader title={t.admin.messages.title} intro={t.admin.messages.intro} />
      <nav aria-label={t.admin.messages.title} className="flex gap-2">
        {FILTERS.map((x) => (
          <Link
            key={x}
            href={`/admin/messages?etat=${x}`}
            aria-current={x === filter ? "page" : undefined}
            className={`rounded-full border px-3 py-1.5 text-sm ${
              x === filter
                ? "border-primary bg-primary-soft font-semibold text-primary-strong dark:bg-primary-strong/25 dark:text-lavande"
                : "border-neutral-300 bg-white dark:border-neutral-700 dark:bg-neutral-900"
            }`}
          >
            {t.admin.messages.filters[x]}
          </Link>
        ))}
      </nav>
      <ActionNotice ok={params.ok} error={params.erreur} />
      <Suspense fallback={null}>
        <MessagesContent filter={filter} />
      </Suspense>
    </>
  );
}

async function MessagesContent({ filter }: { filter: Filter }) {
  const status: SupportStatus | null = filter === "all" ? null : filter;
  const [t, locale, requests] = await Promise.all([getT(), getLocale(), listSupportRequests(status)]);
  const f = adminFormat(locale);
  const m = t.admin.messages;

  if (requests.length === 0) return <p className="text-sm text-neutral-600 dark:text-neutral-300">{m.empty}</p>;

  return (
    <ul className="flex flex-col gap-3">
      {requests.map((r) => (
        <li key={r.id} className="flex flex-col gap-2 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="font-semibold">
              {fill(m.sentBy, { username: r.username ?? t.admin.dash, contact: r.contact ?? t.admin.dash })}
            </span>
            <span className="text-neutral-600 dark:text-neutral-400">{f.dateTime(r.created_at)}</span>
          </div>
          <p className="text-sm whitespace-pre-wrap">{r.message}</p>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-600 dark:text-neutral-400">
            <span>
              {r.notified_email_at || r.notified_whatsapp_at
                ? [r.notified_email_at ? m.email : null, r.notified_whatsapp_at ? m.whatsapp : null].filter(Boolean).join(" · ")
                : m.notSent}
              {" · "}
              <strong className={r.status === "nouvelle" ? "text-orange-700 dark:text-orange-400" : "text-green-700 dark:text-green-400"}>
                {m.statuses[r.status]}
              </strong>
            </span>
            <form action={setSupportStatusAction}>
              <input type="hidden" name="id" value={r.id} />
              <input type="hidden" name="status" value={r.status === "nouvelle" ? "traitee" : "nouvelle"} />
              <input type="hidden" name="returnTo" value={`/admin/messages?etat=${filter}`} />
              <button type="submit" className={secondaryButtonClass}>
                {r.status === "nouvelle" ? m.markDone : m.reopen}
              </button>
            </form>
          </div>
        </li>
      ))}
    </ul>
  );
}
