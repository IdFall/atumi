import Link from "next/link";
import { Suspense } from "react";

import { ActionNotice, Card, PageHeader, Table, buttonClass, inputClass } from "@/components/admin/ui";
import { COUNTRIES } from "@/config/countries";
import { fill } from "@/i18n/format";
import { getLocale, getT } from "@/i18n/server";
import { adminFormat } from "@/lib/admin-format";
import { formatMoney, minorToMajor } from "@/lib/money";
import { cancelSubscriptionAction, confirmPaymentAction, rejectPaymentAction, savePlanAction } from "@/server/admin/actions";
import { listPendingPayments, listPlans, listSubscriptions, type AdminPlan } from "@/server/admin/queries";

/** Forfaits (prix, durée, limites) et derniers paiements. */
export default async function AdminPlansPage({ searchParams }: PageProps<"/admin/forfaits">) {
  const t = await getT();
  const params = await searchParams;
  return (
    <>
      <PageHeader title={t.admin.plans.title} intro={t.admin.plans.intro} />
      <ActionNotice ok={params.ok} error={params.erreur} />
      <Suspense fallback={null}>
        <PlansContent />
      </Suspense>
    </>
  );
}

async function PlansContent() {
  const [t, locale, plans, payments, pending] = await Promise.all([
    getT(),
    getLocale(),
    listPlans(),
    listSubscriptions(),
    listPendingPayments(),
  ]);
  const f = adminFormat(locale);
  const p = t.admin.plans;
  const providers = p.providers as Record<string, string>;
  const limit = (v: number | null) => (v === null ? "∞" : f.n(v));

  return (
    <>
      <Card title={p.pendingTitle}>
        <p className="text-sm text-neutral-600 dark:text-neutral-300">{pending.length ? p.pendingIntro : p.pendingEmpty}</p>
        {pending.length ? (
          <Table
            head={[
              p.pendingColumns.date,
              p.pendingColumns.user,
              p.pendingColumns.plan,
              p.pendingColumns.amount,
              p.pendingColumns.provider,
              p.pendingColumns.reference,
              "",
            ]}
          >
            {pending.map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap">{f.dateTime(r.created_at)}</td>
                <td>
                  <span className="flex flex-col">
                    <strong>{r.username ?? t.admin.dash}</strong>
                    <span className="text-xs text-neutral-600 dark:text-neutral-400">{r.contact ?? t.admin.dash}</span>
                  </span>
                </td>
                <td>{r.plan_label ?? r.plan_code}</td>
                <td className="whitespace-nowrap font-semibold">{formatMoney(r.price_minor, r.currency, f.tag)}</td>
                <td>{providers[r.provider] ?? r.provider}</td>
                <td className="break-all font-mono text-xs">{r.reference}</td>
                <td>
                  <div className="flex gap-2">
                    <form action={confirmPaymentAction}>
                      <input type="hidden" name="requestId" value={r.id} />
                      <input type="hidden" name="returnTo" value="/admin/forfaits" />
                      <button type="submit" className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-white">
                        {p.confirm}
                      </button>
                    </form>
                    <form action={rejectPaymentAction}>
                      <input type="hidden" name="requestId" value={r.id} />
                      <input type="hidden" name="returnTo" value="/admin/forfaits" />
                      <button type="submit" className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-700 dark:border-red-900 dark:text-red-300">
                        {p.reject}
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        ) : null}
      </Card>

      <Card title={p.title}>
        <Table head={[p.columns.plan, p.columns.price, p.columns.duration, p.columns.limits, p.columns.subscribers, p.columns.status]}>
          {plans.map((plan) => (
            <tr key={plan.code}>
              <td>
                <span className="flex flex-col">
                  <strong>{plan.label}</strong>
                  <span className="text-xs text-neutral-600 dark:text-neutral-400">
                    {plan.code} · {p.kinds[plan.kind]}
                  </span>
                </span>
              </td>
              <td className="whitespace-nowrap">{formatMoney(plan.price_minor, plan.currency, f.tag)}</td>
              <td className="whitespace-nowrap">{fill(p.days, { n: plan.duration_days })}</td>
              <td className="text-xs">
                {fill(p.limitsSummary, {
                  documents: limit(plan.document_limit),
                  quizzes: limit(plan.quiz_limit),
                  messages: limit(plan.tutor_message_limit),
                  minutes: limit(plan.call_minutes_limit),
                })}
              </td>
              <td className="tabular-nums">{f.n(plan.subscribers)}</td>
              <td>{plan.is_active ? p.active : p.inactive}</td>
            </tr>
          ))}
        </Table>
        <div className="flex flex-col gap-2">
          {plans.map((plan) => (
            <details key={plan.code} className="rounded-lg border border-neutral-200 dark:border-neutral-800">
              <summary className="cursor-pointer px-3 py-2 text-sm font-semibold">
                {p.edit} : {plan.label}
              </summary>
              <PlanForm plan={plan} />
            </details>
          ))}
        </div>
      </Card>

      <Card title={p.newTitle}>
        <PlanForm />
      </Card>

      <Card title={p.paymentsTitle}>
        {payments.length === 0 ? (
          <p className="text-sm text-neutral-600 dark:text-neutral-300">{p.noPayments}</p>
        ) : (
          <Table
            head={[
              p.paymentColumns.date,
              p.paymentColumns.user,
              p.paymentColumns.plan,
              p.paymentColumns.amount,
              p.paymentColumns.provider,
              p.paymentColumns.reference,
              p.paymentColumns.period,
              p.paymentColumns.status,
            ]}
          >
            {payments.map((s) => (
              <tr key={s.id}>
                <td className="whitespace-nowrap">{f.dateTime(s.created_at)}</td>
                <td>
                  <Link href={`/admin/utilisateurs?q=${encodeURIComponent(s.username ?? "")}&utilisateur=${s.user_id}`} className="font-semibold text-primary dark:text-lavande">
                    {s.username ?? t.admin.dash}
                  </Link>
                </td>
                <td>{s.plan_label ?? s.plan_code}</td>
                <td className="whitespace-nowrap">{formatMoney(s.amount_minor, s.currency, f.tag)}</td>
                <td>{providers[s.payment_provider] ?? s.payment_provider}</td>
                <td className="break-all">{s.payment_reference}</td>
                <td className="whitespace-nowrap text-xs">
                  {f.date(s.starts_at)} → {f.date(s.ends_at)}
                </td>
                <td>
                  {s.status === "active" ? (
                    <form action={cancelSubscriptionAction} className="flex items-center gap-2">
                      <span>{p.statuses.active}</span>
                      <input type="hidden" name="subscriptionId" value={s.id} />
                      <input type="hidden" name="returnTo" value="/admin/forfaits" />
                      <button type="submit" className="text-xs text-red-700 underline dark:text-red-300">
                        {p.cancel}
                      </button>
                    </form>
                  ) : (
                    p.statuses[s.status]
                  )}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}

/** Formulaire d'un forfait : modification (plan donné) ou création. */
async function PlanForm({ plan }: { plan?: AdminPlan }) {
  const t = await getT();
  const fields = t.admin.plans.fields;
  const countries = COUNTRIES.filter((c) => c.isActive);
  const currency = plan?.currency ?? countries[0]?.currency ?? "XOF";
  const value = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(v));
  const id = plan?.code ?? "nouveau";

  return (
    <form action={savePlanAction} className="grid gap-3 p-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
      <input type="hidden" name="returnTo" value="/admin/forfaits" />
      {plan ? (
        <>
          <input type="hidden" name="code" value={plan.code} />
          <input type="hidden" name="countryCode" value={plan.country_code} />
        </>
      ) : (
        <>
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="font-medium">{fields.code}</span>
            <input name="code" required pattern="[a-z]{2}-[a-z0-9\-]{2,40}" placeholder="sn-mois" className={inputClass} />
            <span className="text-xs text-neutral-600 dark:text-neutral-400">{fields.codeHint}</span>
          </label>
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="font-medium">{fields.country}</span>
            <select name="countryCode" className={inputClass}>
              {countries.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </>
      )}
      <Input id={id} name="label" label={fields.label} defaultValue={plan?.label} required wide />
      <Input id={id} name="price" label={fill(fields.price, { currency })} defaultValue={plan ? String(minorToMajor(plan.price_minor, plan.currency)) : ""} required numeric />
      <Input id={id} name="durationDays" label={fields.duration} defaultValue={value(plan?.duration_days)} required numeric />
      <Input id={id} name="documentLimit" label={fields.documentLimit} defaultValue={value(plan?.document_limit)} numeric placeholder={t.admin.unlimited} />
      <Input id={id} name="quizLimit" label={fields.quizLimit} defaultValue={value(plan?.quiz_limit)} numeric placeholder={t.admin.unlimited} />
      <Input id={id} name="quizQuestionLimit" label={fields.quizQuestionLimit} defaultValue={value(plan?.quiz_question_limit)} numeric placeholder="3–30" />
      <Input id={id} name="tutorMessageLimit" label={fields.tutorMessageLimit} defaultValue={value(plan?.tutor_message_limit)} numeric placeholder={t.admin.unlimited} />
      <Input id={id} name="callMinutesLimit" label={fields.callMinutesLimit} defaultValue={value(plan?.call_minutes_limit)} numeric placeholder={t.admin.unlimited} />
      <label className="flex items-center gap-2 sm:col-span-2">
        <input type="checkbox" name="isActive" defaultChecked={plan?.is_active ?? false} className="h-4 w-4" />
        <span>{fields.isActive}</span>
      </label>
      <div className="sm:col-span-2 lg:col-span-4">
        <button type="submit" className={buttonClass}>
          {plan ? t.admin.plans.save : t.admin.plans.create}
        </button>
      </div>
    </form>
  );
}

function Input({
  id,
  name,
  label,
  defaultValue,
  required,
  numeric,
  wide,
  placeholder,
}: {
  id: string;
  name: string;
  label: string;
  defaultValue?: string;
  required?: boolean;
  numeric?: boolean;
  wide?: boolean;
  placeholder?: string;
}) {
  return (
    <label className={`flex flex-col gap-1 ${wide ? "sm:col-span-2" : ""}`} htmlFor={`${id}-${name}`}>
      <span className="font-medium">{label}</span>
      <input
        id={`${id}-${name}`}
        name={name}
        defaultValue={defaultValue}
        required={required}
        inputMode={numeric ? "numeric" : undefined}
        placeholder={placeholder}
        className={inputClass}
      />
    </label>
  );
}
