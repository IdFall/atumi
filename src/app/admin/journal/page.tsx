import { Suspense } from "react";

import { Card, PageHeader, Table } from "@/components/admin/ui";
import { getLocale, getT } from "@/i18n/server";
import { adminFormat } from "@/lib/admin-format";
import { getJournal } from "@/server/admin/queries";

/** Journal des actions d'administration. */
export default async function AdminJournalPage() {
  const t = await getT();
  return (
    <>
      <PageHeader title={t.admin.journal.title} intro={t.admin.journal.intro} />
      <Suspense fallback={null}>
        <JournalContent />
      </Suspense>
    </>
  );
}

async function JournalContent() {
  const [t, locale, entries] = await Promise.all([getT(), getLocale(), getJournal()]);
  const f = adminFormat(locale);
  const j = t.admin.journal;
  const actions = j.actions as Record<string, string>;
  return (
    <Card title={j.title}>
      {entries.length === 0 ? (
        <p className="text-sm text-neutral-600 dark:text-neutral-300">{j.empty}</p>
      ) : (
        <Table head={[j.columns.date, j.columns.admin, j.columns.action, j.columns.target, j.columns.details]}>
          {entries.map((e) => (
            <tr key={e.id}>
              <td className="whitespace-nowrap">{f.dateTime(e.created_at)}</td>
              <td>{e.admin_username ?? t.admin.dash}</td>
              <td>{actions[e.action] ?? e.action}</td>
              <td>{e.target_username ?? t.admin.dash}</td>
              <td className="text-xs text-neutral-600 dark:text-neutral-400">
                {Object.entries(e.details)
                  .map(([k, v]) => `${k} : ${String(v)}`)
                  .join(" · ")}
              </td>
            </tr>
          ))}
        </Table>
      )}
    </Card>
  );
}
