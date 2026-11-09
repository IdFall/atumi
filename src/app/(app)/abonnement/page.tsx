import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { PaymentForm } from "@/components/billing/payment-form";
import { AccessBanner } from "@/components/courses/access-banner";
import { getCountry } from "@/config/countries";
import { fill } from "@/i18n/format";
import { getLocale, getT } from "@/i18n/server";
import { DATE_LOCALES } from "@/i18n/messages";
import { formatMoney } from "@/lib/money";
import { getCurrentUser } from "@/server/auth/session";
import { paymentNumbers } from "@/server/billing/numbers";
import { listMyPaymentRequests, listOfferedPlans, type OfferedPlan } from "@/server/billing/queries";
import { getAccess } from "@/server/courses/queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t.subscribe.title };
}

/** S'abonner : forfaits, numéros de paiement de l'équipe, déclaration du paiement. */
export default async function SubscribePage() {
  const t = await getT();
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-5 px-4 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">{t.subscribe.title}</h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-300">{t.subscribe.intro}</p>
      </header>
      <Suspense fallback={<p>{t.dashboard.loading}</p>}>
        <SubscribeContent />
      </Suspense>
    </main>
  );
}

async function SubscribeContent() {
  const [t, locale, user, access] = await Promise.all([getT(), getLocale(), getCurrentUser(), getAccess()]);
  const [plans, requests] = await Promise.all([listOfferedPlans(user.countryCode), listMyPaymentRequests()]);
  const s = t.subscribe;
  const tag = DATE_LOCALES[locale];
  const methods = getCountry(user.countryCode)?.paymentMethods ?? [];
  const numbers = paymentNumbers(user.countryCode, methods);
  const providerLabels = t.admin.plans.providers as Record<string, string>;
  const providers = (numbers.length ? numbers.map((n) => n.method) : methods).map((id) => ({ id, label: providerLabels[id] ?? id }));

  return (
    <>
      <AccessBanner access={access} />

      {plans.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-300 p-4 text-sm dark:border-neutral-700">
          {s.noPlans}{" "}
          <Link href="/aide" className="font-semibold text-primary dark:text-lavande">
            {t.help.link}
          </Link>
        </p>
      ) : (
        <>
          <ul className="flex flex-col gap-3">
            {plans.map((plan) => (
              <PlanCard key={plan.code} plan={plan} tag={tag} />
            ))}
          </ul>

          <section className="flex flex-col gap-2 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-nuit">
            <h2 className="font-semibold">{s.step1}</h2>
            {numbers.length ? (
              <>
                <p className="text-sm">{s.numbersIntro}</p>
                <ul className="flex flex-col gap-1 text-sm">
                  {numbers.map((n) => (
                    <li key={n.method} className="flex justify-between gap-2">
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
          </section>

          <section className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-nuit">
            <h2 className="font-semibold">{s.step2}</h2>
            <PaymentForm plans={plans.map((p) => ({ code: p.code, label: `${p.label} · ${formatMoney(p.priceMinor, p.currency, tag)}` }))} providers={providers} />
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
    </>
  );
}

async function PlanCard({ plan, tag }: { plan: OfferedPlan; tag: string }) {
  const t = await getT();
  const s = t.subscribe;
  const n = (v: number | null) => (v === null ? s.unlimited : String(v));
  const features = [
    fill(s.features.documents, { n: n(plan.documentLimit) }),
    fill(s.features.quizzes, { n: n(plan.quizLimit) }),
    fill(s.features.messages, { n: n(plan.tutorMessageLimit) }),
    ...(plan.callMinutesLimit === 0 ? [] : [fill(s.features.calls, { n: n(plan.callMinutesLimit) })]),
  ];
  return (
    <li className="flex flex-col gap-2 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-nuit">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">{plan.label}</h2>
        <p>
          <strong className="text-lg text-primary dark:text-lavande">{formatMoney(plan.priceMinor, plan.currency, tag)}</strong>{" "}
          <span className="text-sm text-neutral-600 dark:text-neutral-300">{fill(s.perDays, { n: plan.durationDays })}</span>
        </p>
      </div>
      <ul className="flex flex-col gap-0.5 text-sm text-neutral-700 dark:text-neutral-300">
        {features.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>
    </li>
  );
}
