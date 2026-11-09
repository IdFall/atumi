import Link from "next/link";
import { Suspense } from "react";

import { ActionNotice, Bar, Card, PageHeader, PeriodPicker, Stat, Table } from "@/components/admin/ui";
import { fill } from "@/i18n/format";
import { getLocale, getT } from "@/i18n/server";
import { adminFormat } from "@/lib/admin-format";
import { formatMoney } from "@/lib/money";
import { getDailyActivity, getOverview, listPendingPayments } from "@/server/admin/queries";
import { parsePeriod } from "@/server/admin/schemas";

/** Vue d'ensemble : le fonctionnement global d'ATUMI en chiffres. */
export default async function AdminOverviewPage({ searchParams }: PageProps<"/admin">) {
  const t = await getT();
  const params = await searchParams;
  const period = parsePeriod(params.jours);
  return (
    <>
      <PageHeader title={t.admin.overview.title} intro={t.admin.overview.intro}>
        <PeriodPicker period={period} />
      </PageHeader>
      <ActionNotice ok={params.ok} error={params.erreur} />
      <Suspense fallback={null}>
        <OverviewContent days={Number(period)} />
      </Suspense>
    </>
  );
}

async function OverviewContent({ days }: { days: number }) {
  const [t, locale, o, daily, pending] = await Promise.all([
    getT(),
    getLocale(),
    getOverview(days),
    getDailyActivity(Math.min(days, 14)),
    listPendingPayments(),
  ]);
  const f = adminFormat(locale);
  const ov = t.admin.overview;
  const cycles = t.auth.cycles as Record<string, string>;
  const languages = t.tutor.languages as Record<string, string>;
  const cycleTotal = Object.values(o.users_by_cycle).reduce((a, b) => a + b, 0);
  const languageTotal = Object.values(o.users_by_tutor_language).reduce((a, b) => a + b, 0);
  const revenue = o.revenue.length
    ? o.revenue
        .reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.currency]: (acc[r.currency] ?? 0) + r.amount_minor }), {})
    : null;
  const providers = t.admin.plans.providers as Record<string, string>;
  const maxDaily = Math.max(1, ...daily.map((d) => Math.max(d.signups, d.documents, d.quizzes, d.tutor_messages)));

  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={ov.users} value={f.n(o.users_total)} hint={fill(ov.usersNew, { n: f.n(o.users_new) })} />
        <Stat label={ov.trials} value={f.n(o.trials_active)} hint={fill(ov.trialsHint, { started: f.n(o.trials_started) })} />
        <Stat
          label={ov.subscribers}
          value={f.n(o.subscribers_active)}
          hint={fill(ov.subscribersHint, { converted: f.n(o.trials_converted), ended: f.n(o.trials_ended) })}
        />
        <Stat
          label={ov.revenue}
          value={
            revenue
              ? Object.entries(revenue)
                  .map(([currency, amount]) => formatMoney(amount, currency, f.tag))
                  .join(" + ")
              : f.n(0)
          }
          hint={
            revenue
              ? o.revenue.map((r) => `${providers[r.provider] ?? r.provider} ${f.n(r.payments)}`).join(" · ")
              : ov.revenueNone
          }
        />
      </div>
      {pending.length > 0 ? (
        <p role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-orange-50 p-3 text-sm text-orange-900 dark:bg-orange-950 dark:text-orange-100">
          <span>{fill(ov.paymentsPending, { n: f.n(pending.length) })}</span>
          <Link href="/admin/forfaits" className="font-semibold underline">
            {ov.paymentsLink}
          </Link>
        </p>
      ) : null}
      {o.never_imported > 0 ? (
        <p className="rounded-lg bg-primary-soft p-3 text-sm text-nuit dark:bg-primary-strong/25 dark:text-lavande">
          {fill(ov.neverImported, { n: f.n(o.never_imported) })}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title={ov.usageTitle}>
          <dl className="grid grid-cols-1 gap-3 text-sm">
            <UsageLine label={ov.imports} value={f.n(o.documents_imported)} hint={fill(ov.importsHint, { failed: f.n(o.documents_failed), pending: f.n(o.documents_pending) })} />
            <UsageLine label={ov.syntheses} value={f.n(o.syntheses)} />
            <UsageLine
              label={ov.quizzes}
              value={f.n(o.quizzes)}
              hint={fill(ov.quizzesHint, {
                attempts: f.n(o.quiz_attempts),
                average: o.quiz_average === null ? t.admin.dash : fill(ov.percent, { n: f.n(o.quiz_average) }),
              })}
            />
            <UsageLine label={ov.tutor} value={f.n(o.tutor_messages)} />
            <UsageLine label={ov.calls} value={f.n(o.calls)} hint={fill(ov.callsHint, { minutes: f.n(o.call_minutes) })} />
            <UsageLine label={ov.contestations} value={f.n(o.contestations)} />
          </dl>
        </Card>

        <Card title={ov.studentsTitle}>
          <h3 className="text-sm font-semibold text-neutral-600 dark:text-neutral-300">{ov.byCycle}</h3>
          {Object.entries(o.users_by_cycle).map(([cycle, n]) => (
            <Bar key={cycle} label={cycles[cycle] ?? cycle} value={n} total={cycleTotal} display={`${f.n(n)} (${fill(ov.percent, { n: cycleTotal ? Math.round((n / cycleTotal) * 100) : 0 })})`} />
          ))}
          <h3 className="pt-2 text-sm font-semibold text-neutral-600 dark:text-neutral-300">{ov.byLanguage}</h3>
          {Object.entries(o.users_by_tutor_language).map(([lang, n]) => (
            <Bar key={lang} label={languages[lang] ?? lang} value={n} total={languageTotal} display={`${f.n(n)} (${fill(ov.percent, { n: languageTotal ? Math.round((n / languageTotal) * 100) : 0 })})`} />
          ))}
        </Card>

        <div className="flex flex-col gap-4">
          <Card title={ov.helpTitle}>
            <dl className="grid gap-3 text-sm">
              <UsageLine label={ov.helpQuestions} value={f.n(o.help_questions)} hint={fill(ov.helpRating, { yes: f.n(o.help_helpful), no: f.n(o.help_not_helpful) })} />
              <UsageLine label={ov.supportOpen} value={f.n(o.support_open)} warn={o.support_open > 0} />
            </dl>
            <Link href="/admin/messages" className="text-sm font-semibold text-primary dark:text-lavande">
              {ov.supportLink} →
            </Link>
          </Card>
          <Card title={ov.aiTitle}>
            <dl className="grid gap-3 text-sm">
              <UsageLine
                label={ov.aiCalls}
                value={f.n(o.ai_calls)}
                hint={fill(ov.aiTokens, { input: f.n(o.ai_input_tokens), output: f.n(o.ai_output_tokens) })}
              />
            </dl>
            <Link href="/admin/ia" className="text-sm font-semibold text-primary dark:text-lavande">
              {ov.aiLink} →
            </Link>
          </Card>
        </div>
      </div>

      <Card title={ov.dailyTitle}>
        <Table head={[ov.dailyDay, ov.dailySignups, ov.dailyImports, ov.dailyQuizzes, ov.dailyMessages, ov.dailyMinutes]}>
          {[...daily].reverse().map((d) => (
            <tr key={d.day}>
              <td className="whitespace-nowrap">{f.day(d.day)}</td>
              {[d.signups, d.documents, d.quizzes, d.tutor_messages].map((v, i) => (
                <td key={i}>
                  <span className="flex items-center gap-2">
                    <span className="w-8 text-right tabular-nums">{f.n(v)}</span>
                    <span className="h-2 rounded bg-primary/70" style={{ width: `${Math.round((v / maxDaily) * 80)}px` }} aria-hidden="true" />
                  </span>
                </td>
              ))}
              <td className="tabular-nums">{f.n(d.call_minutes)}</td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}

function UsageLine({ label, value, hint, warn }: { label: string; value: string; hint?: string; warn?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex justify-between gap-2">
        <dt>{label}</dt>
        <dd className={`font-semibold tabular-nums ${warn ? "text-orange-700 dark:text-orange-400" : ""}`}>{value}</dd>
      </div>
      {hint ? <dd className="text-xs text-neutral-600 dark:text-neutral-400">{hint}</dd> : null}
    </div>
  );
}
