import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { PaymentForm } from "@/components/billing/payment-form";
import { AccessBanner } from "@/components/courses/access-banner";
import { getCountry } from "@/config/countries";
import { formatBytes } from "@/config/library";
import { fill } from "@/i18n/format";
import { DATE_LOCALES, type Messages } from "@/i18n/messages";
import { getLocale, getT } from "@/i18n/server";
import { serverEnv } from "@/lib/env";
import { formatMoney } from "@/lib/money";
import { getCurrentUser } from "@/server/auth/session";
import { paymentNumbers } from "@/server/billing/numbers";
import { getMyUsage, listMyPaymentRequests, listOfferedPlans, type MyUsage, type OfferedPlan } from "@/server/billing/queries";
import { getAccess } from "@/server/courses/queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t.subscribe.title };
}

/** Abonnement : ce qu'il reste, forfaits (au mois ou plusieurs mois), recharges, paiement. */
export default async function SubscribePage({ searchParams }: PageProps<"/abonnement">) {
  const t = await getT();
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">{t.subscribe.title}</h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-300">{t.subscribe.intro}</p>
      </header>
      <Suspense fallback={<p>{t.dashboard.loading}</p>}>
        <SubscribeContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Nombre de mois d'un forfait (30 jours = 1 mois). */
function monthsOf(plan: OfferedPlan): number {
  return Math.max(1, Math.round(plan.durationDays / 30));
}

function query(params: { duree: number; forfait?: string }): string {
  const q = new URLSearchParams({ duree: String(params.duree) });
  if (params.forfait) q.set("forfait", params.forfait);
  return `/abonnement?${q.toString()}`;
}

async function SubscribeContent({ searchParams }: { searchParams: PageProps<"/abonnement">["searchParams"] }) {
  const [t, locale, user, access, usage, params] = await Promise.all([
    getT(),
    getLocale(),
    getCurrentUser(),
    getAccess(),
    getMyUsage(),
    searchParams,
  ]);
  const [plans, requests] = await Promise.all([listOfferedPlans(user.countryCode), listMyPaymentRequests()]);
  const s = t.subscribe;
  const tag = DATE_LOCALES[locale];
  const callsAvailable = Boolean(serverEnv().GEMINI_API_KEY);

  const subscriptions = plans.filter((p) => p.kind === "abonnement");
  const recharges = plans.filter((p) => p.kind === "recharge");
  const durations = [...new Set(subscriptions.map(monthsOf))].sort((a, b) => a - b);
  const askedDuration = Number(one(params.duree));
  const duration = durations.includes(askedDuration) ? askedDuration : (durations[0] ?? 1);
  const shown = subscriptions.filter((p) => monthsOf(p) === duration);
  // Le forfait le plus complet (le plus cher) de la durée affichée.
  const topCode = shown.reduce<OfferedPlan | undefined>((best, p) => (!best || p.priceMinor > best.priceMinor ? p : best), undefined)?.code;
  const chosen = plans.find((p) => p.code === one(params.forfait)) ?? shown[0];
  const subscribed = access.state === "subscribed";

  const methods = getCountry(user.countryCode)?.paymentMethods ?? [];
  const numbers = paymentNumbers(user.countryCode, methods);
  const providerLabels = t.admin.plans.providers as Record<string, string>;
  const providers = (numbers.length ? numbers.map((n) => n.method) : methods).map((id) => ({ id, label: providerLabels[id] ?? id }));
  const money = (minor: number, currency: string) => formatMoney(minor, currency, tag);
  // Choix proposés dans le formulaire : les forfaits, puis les recharges (abonnés).
  const formPlans = [...subscriptions, ...(subscribed ? recharges : [])];
  if (chosen && !formPlans.some((p) => p.code === chosen.code)) formPlans.unshift(chosen);

  return (
    <>
      <AccessBanner access={access} />
      {usage ? <UsageCard usage={usage} s={s} tag={tag} /> : null}

      {subscriptions.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-300 p-4 text-sm dark:border-neutral-700">
          {s.noPlans}{" "}
          <Link href="/aide" className="font-semibold text-primary dark:text-lavande">
            {t.help.link}
          </Link>
        </p>
      ) : (
        <>
          <section className="flex flex-col gap-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              {durations.length > 1 ? (
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-semibold">{s.durationLabel}</span>
                  <nav aria-label={s.durationLabel} className="flex gap-2">
                    {durations.map((d) => (
                      <Link
                        key={d}
                        href={query({ duree: d })}
                        aria-current={d === duration ? "page" : undefined}
                        scroll={false}
                        className={`rounded-full border px-4 py-2.5 text-sm font-semibold ${
                          d === duration
                            ? "border-nuit bg-nuit text-white dark:border-lavande dark:bg-lavande dark:text-nuit"
                            : "border-neutral-300 bg-white dark:border-neutral-700 dark:bg-neutral-900"
                        }`}
                      >
                        {d === 1 ? s.oneMonth : fill(s.months, { n: d })}
                      </Link>
                    ))}
                  </nav>
                </div>
              ) : null}
            </div>

            <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {shown.map((plan) => (
                <PlanCard
                  key={plan.code}
                  plan={plan}
                  s={s}
                  tag={tag}
                  callsAvailable={callsAvailable}
                  selected={plan.code === chosen?.code}
                  top={plan.code === topCode && shown.length > 1}
                  href={`${query({ duree: duration, forfait: plan.code })}#payer`}
                />
              ))}
            </ul>
          </section>

          {recharges.length ? (
            <section id="recharges" className="flex scroll-mt-4 flex-col gap-3">
              <h2 className="text-xl font-bold">{s.rechargesTitle}</h2>
              <p className="text-sm text-neutral-600 dark:text-neutral-300">{s.rechargesIntro}</p>
              {!subscribed ? <p className="text-sm font-semibold">{s.rechargesSubscribersOnly}</p> : null}
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {recharges.map((r) => (
                  <li
                    key={r.code}
                    className={`flex items-center justify-between gap-3 rounded-xl border bg-white p-4 dark:bg-nuit ${
                      r.code === chosen?.code ? "border-2 border-primary" : "border-neutral-200 dark:border-neutral-800"
                    }`}
                  >
                    <div className="flex flex-col">
                      <span className="font-semibold">{r.label}</span>
                      <span className="text-sm text-neutral-600 dark:text-neutral-300">{money(r.priceMinor, r.currency)}</span>
                    </div>
                    {subscribed ? (
                      <Link
                        href={`${query({ duree: duration, forfait: r.code })}#payer`}
                        className="rounded-xl border-2 border-primary px-4 py-2 text-sm font-semibold text-primary-strong dark:text-lavande"
                      >
                        {s.buy}
                      </Link>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section
            id="payer"
            className="flex scroll-mt-4 flex-col gap-4 rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-nuit"
          >
            <h2 className="text-xl font-bold">{s.payTitle}</h2>
            {chosen ? <p className="text-sm">{fill(s.chosenPlan, { plan: chosen.label, price: money(chosen.priceMinor, chosen.currency) })}</p> : null}
            <div className="flex flex-col gap-2">
              <h3 className="font-semibold">{s.step1}</h3>
              {numbers.length ? (
                <>
                  <p className="text-sm">{s.numbersIntro}</p>
                  <ul className="flex flex-col gap-1 text-sm">
                    {numbers.map((n) => (
                      <li key={n.method} className="flex justify-between gap-2 rounded-lg bg-neutral-50 px-3 py-2 dark:bg-neutral-900">
                        <span>{providerLabels[n.method] ?? n.method}</span>
                        <strong className="tabular-nums">{n.number}</strong>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="text-sm">
                  {s.noNumbers}{" "}
                  <Link href="/aide" className="font-semibold text-primary dark:text-lavande">
                    {t.help.link}
                  </Link>
                </p>
              )}
            </div>
            <div className="flex flex-col gap-3">
              <h3 className="font-semibold">{s.step2}</h3>
              <PaymentForm
                plans={formPlans.map((p) => ({ code: p.code, label: `${p.label} · ${money(p.priceMinor, p.currency)}` }))}
                providers={providers}
                defaultCode={chosen?.code}
              />
            </div>
            <p className="text-sm text-neutral-600 dark:text-neutral-300">{s.step3}</p>
          </section>
        </>
      )}

      {requests.length ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-neutral-600 dark:text-neutral-300">{s.myRequests}</h2>
          <ul className="flex flex-col gap-2 text-sm">
            {requests.map((r) => (
              <li key={r.id} className="flex flex-wrap justify-between gap-2 rounded-xl border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-nuit">
                <span>
                  {r.planLabel} · {providerLabels[r.provider] ?? r.provider} · {r.reference}
                </span>
                <strong className={r.status === "validee" ? "text-green-700 dark:text-green-400" : r.status === "refusee" ? "text-red-700 dark:text-red-400" : ""}>
                  {s.statuses[r.status]}
                </strong>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="text-xs text-neutral-600 dark:text-neutral-300">{s.spaceNote}</p>
    </>
  );
}

type SubscribeMessages = Messages["subscribe"];

function UsageCard({ usage, s, tag }: { usage: MyUsage; s: SubscribeMessages; tag: string }) {
  const u = s.usage;
  const rows: { label: string; value: string; percent: number | null; tone: string }[] = [
    {
      label: u.space,
      value:
        usage.storageLimit === null
          ? fill(u.of, { used: formatBytes(usage.storageUsed, tag), total: u.unlimited })
          : fill(u.of, { used: formatBytes(usage.storageUsed, tag), total: formatBytes(usage.storageLimit, tag) }),
      percent: usage.storageLimit ? Math.min(100, Math.round((usage.storageUsed / usage.storageLimit) * 100)) : null,
      tone: "bg-accent",
    },
    {
      label: u.messages,
      value: usage.messageLimit === null ? u.unlimited : fill(u.of, { used: String(usage.messagesUsed), total: String(usage.messageLimit) }),
      percent: usage.messageLimit ? Math.min(100, Math.round((usage.messagesUsed / usage.messageLimit) * 100)) : null,
      tone: "bg-primary",
    },
    {
      label: u.calls,
      value:
        usage.callSecondsLeft === null
          ? u.unlimited
          : usage.callMinutesLimit === 0 && usage.callSecondsLeft === 0
            ? u.notIncluded
            : fill(u.minutesLeft, { n: Math.floor(usage.callSecondsLeft / 60) }),
      percent: null,
      tone: "",
    },
  ];
  return (
    <section aria-label={u.title} className="grid gap-4 rounded-2xl border border-neutral-200 bg-white p-4 sm:grid-cols-3 dark:border-neutral-800 dark:bg-nuit">
      {rows.map((r) => (
        <div key={r.label} className="flex flex-col gap-1.5">
          <div className="flex justify-between gap-2 text-sm">
            <span>{r.label}</span>
            <strong className="tabular-nums">{r.value}</strong>
          </div>
          {r.percent !== null ? (
            <div className="h-2 rounded-full bg-neutral-200 dark:bg-neutral-700" aria-hidden="true">
              <div className={`h-2 rounded-full ${r.tone}`} style={{ width: `${r.percent}%` }} />
            </div>
          ) : null}
        </div>
      ))}
    </section>
  );
}

function PlanCard({
  plan,
  s,
  tag,
  callsAvailable,
  selected,
  top,
  href,
}: {
  plan: OfferedPlan;
  s: SubscribeMessages;
  tag: string;
  callsAvailable: boolean;
  selected: boolean;
  /** Le forfait le plus complet : mis en avant. */
  top: boolean;
  href: string;
}) {
  const months = monthsOf(plan);
  const n = (v: number | null) => (v === null ? s.unlimited : String(v));
  const features = [
    plan.storageBytes !== null ? fill(s.features.storage, { n: formatBytes(plan.storageBytes, tag) }) : null,
    fill(s.features.documents, { n: n(plan.documentLimit) }),
    fill(s.features.quizzes, { n: n(plan.quizLimit) }),
    plan.quizQuestionLimit !== null ? fill(s.features.quizQuestions, { n: plan.quizQuestionLimit }) : null,
    fill(s.features.messages, { n: n(plan.tutorMessageLimit) }),
    plan.researchDailyLimit !== null ? fill(s.features.research, { n: plan.researchDailyLimit }) : null,
    plan.callMinutesLimit === 0 ? null : fill(callsAvailable ? s.features.calls : s.features.callsSoon, { n: n(plan.callMinutesLimit) }),
  ].filter((f): f is string => f !== null);

  return (
    <li
      className={`flex flex-col gap-3 rounded-2xl bg-white p-5 dark:bg-nuit ${
        selected ? "border-2 border-primary shadow-md" : "border border-neutral-200 dark:border-neutral-800"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-xl font-bold">{plan.label}</h2>
        {top ? <span className="shrink-0 rounded-full bg-primary px-2.5 py-1 text-xs font-bold text-white">{s.topPlan}</span> : null}
      </div>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <strong className="text-3xl font-extrabold text-primary-strong dark:text-lavande">{formatMoney(plan.priceMinor, plan.currency, tag)}</strong>
        <span className="text-sm text-neutral-600 dark:text-neutral-300">
          {months === 1 ? s.perMonth : months > 1 && plan.durationDays % 30 === 0 ? fill(s.perMonths, { n: months }) : fill(s.perDays, { n: plan.durationDays })}
        </span>
      </p>
      {months > 1 ? (
        <p className="-mt-2 text-sm font-semibold text-accent-text dark:text-accent">
          {fill(s.monthlyEquivalent, { price: formatMoney(Math.round(plan.priceMinor / months), plan.currency, tag) })}
        </p>
      ) : null}
      <ul className="flex flex-1 flex-col gap-1.5 text-sm">
        {features.map((f) => (
          <li key={f} className="flex gap-2">
            <span aria-hidden="true" className="font-bold text-accent-text dark:text-accent">
              ✓
            </span>
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <Link
        href={href}
        aria-current={selected ? "true" : undefined}
        className={`rounded-xl px-4 py-3 text-center font-semibold ${
          selected ? "bg-primary text-white" : "border-2 border-primary text-primary-strong dark:text-lavande"
        }`}
      >
        {selected ? s.chosen : fill(s.choose, { plan: plan.label })}
      </Link>
    </li>
  );
}
