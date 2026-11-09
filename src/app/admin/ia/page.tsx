import { Suspense } from "react";

import { Card, PageHeader, PeriodPicker, Table } from "@/components/admin/ui";
import { getLocale, getT } from "@/i18n/server";
import { adminFormat } from "@/lib/admin-format";
import { getAiUsage } from "@/server/admin/queries";
import { parsePeriod } from "@/server/admin/schemas";

/** Consommation du modèle (journal ai_usage), par fonction et par modèle. */
export default async function AdminAiPage({ searchParams }: PageProps<"/admin/ia">) {
  const t = await getT();
  const period = parsePeriod((await searchParams).jours);
  return (
    <>
      <PageHeader title={t.admin.ai.title} intro={t.admin.ai.intro}>
        <PeriodPicker period={period} />
      </PageHeader>
      <Suspense fallback={null}>
        <AiContent days={Number(period)} />
      </Suspense>
    </>
  );
}

async function AiContent({ days }: { days: number }) {
  const [t, locale, lines] = await Promise.all([getT(), getLocale(), getAiUsage(days)]);
  const f = adminFormat(locale);
  const a = t.admin.ai;
  const features = a.features as Record<string, string>;
  return (
    <Card title={t.admin.periods[String(days) as "7" | "30" | "90"]}>
      {lines.length === 0 ? (
        <p className="text-sm text-neutral-600 dark:text-neutral-300">{a.empty}</p>
      ) : (
        <Table head={[a.columns.feature, a.columns.model, a.columns.calls, a.columns.input, a.columns.output, a.columns.cache]}>
          {lines.map((l) => (
            <tr key={`${l.feature}-${l.model}`}>
              <td className="font-semibold">{features[l.feature] ?? l.feature}</td>
              <td className="text-xs">{l.model}</td>
              <td className="tabular-nums">{f.n(l.calls)}</td>
              <td className="tabular-nums">{f.n(l.input_tokens)}</td>
              <td className="tabular-nums">{f.n(l.output_tokens)}</td>
              <td className="tabular-nums">{f.n(l.cache_read_tokens)}</td>
            </tr>
          ))}
        </Table>
      )}
    </Card>
  );
}
