import Link from "next/link";
import { Suspense } from "react";

import {
  ActionNotice,
  Card,
  PageHeader,
  Table,
  buttonClass,
  inputClass,
  secondaryButtonClass,
} from "@/components/admin/ui";
import { getCountry } from "@/config/countries";
import { fill } from "@/i18n/format";
import { getLocale, getT } from "@/i18n/server";
import { adminFormat } from "@/lib/admin-format";
import { formatMoney } from "@/lib/money";
import { cancelSubscriptionAction, grantPlanAction } from "@/server/admin/actions";
import { listPlans, listSubscriptions, listUsers, type AdminUser } from "@/server/admin/queries";
import { MANUAL_PROVIDERS } from "@/server/admin/schemas";

/** Élèves : comptes, droit en cours, activité ; fiche avec paiements et attribution d'un forfait. */
export default async function AdminUsersPage({ searchParams }: PageProps<"/admin/eleves">) {
  const t = await getT();
  const params = await searchParams;
  const search = typeof params.q === "string" ? params.q.slice(0, 32) : "";
  const selected = typeof params.eleve === "string" ? params.eleve : null;
  return (
    <>
      <PageHeader title={t.admin.users.title} intro={t.admin.users.intro}>
        <form className="flex w-full gap-2 sm:w-auto" role="search">
          <label className="sr-only" htmlFor="admin-search">
            {t.admin.users.search}
          </label>
          <input id="admin-search" name="q" defaultValue={search} placeholder={t.admin.users.search} className={`${inputClass} min-w-0 flex-1 sm:w-64`} />
          <button type="submit" className={secondaryButtonClass}>
            {t.admin.users.searchButton}
          </button>
        </form>
      </PageHeader>
      <ActionNotice ok={params.ok} error={params.erreur} />
      <Suspense fallback={null}>
        <UsersContent search={search} selected={selected} />
      </Suspense>
    </>
  );
}

async function UsersContent({ search, selected }: { search: string; selected: string | null }) {
  const [t, locale, users] = await Promise.all([getT(), getLocale(), listUsers(search)]);
  const f = adminFormat(locale);
  const u = t.admin.users;
  const cycles = t.auth.cycles as Record<string, string>;
  const query = search ? `q=${encodeURIComponent(search)}&` : "";
  const current = selected ? users.find((x) => x.user_id === selected) : undefined;

  return (
    <>
      {current ? <UserDetail user={current} returnTo={`/admin/eleves?${query}eleve=${current.user_id}`} closeHref={`/admin/eleves${search ? `?q=${encodeURIComponent(search)}` : ""}`} /> : null}
      <Card title={fill(u.count, { n: f.n(users.length) })}>
        {users.length === 0 ? (
          <p className="text-sm text-neutral-600 dark:text-neutral-300">{u.empty}</p>
        ) : (
          <Table head={[u.columns.user, u.columns.level, u.columns.contact, u.columns.access, u.columns.activity, u.columns.createdAt, u.columns.lastActivity, ""]}>
            {users.map((user) => (
              <tr key={user.user_id} className={user.user_id === selected ? "bg-primary-soft/60 dark:bg-primary-strong/20" : undefined}>
                <td className="font-semibold whitespace-nowrap">
                  {user.username}
                  {user.is_admin ? (
                    <span className="ml-2 rounded bg-nuit px-1.5 py-0.5 text-xs font-medium text-white dark:bg-lavande dark:text-nuit">{u.adminBadge}</span>
                  ) : null}
                </td>
                <td>{user.level_label ?? cycles[user.cycle] ?? user.cycle}</td>
                <td className="whitespace-nowrap text-neutral-600 dark:text-neutral-300">{user.contact ?? t.admin.dash}</td>
                <td>
                  <AccessLabel user={user} />
                </td>
                <td className="tabular-nums whitespace-nowrap">
                  {f.n(user.documents)} · {f.n(user.quizzes)} · {f.n(user.tutor_messages)}
                </td>
                <td className="whitespace-nowrap">{f.date(user.created_at)}</td>
                <td className="whitespace-nowrap">{f.date(user.last_activity)}</td>
                <td>
                  <Link href={`/admin/eleves?${query}eleve=${user.user_id}`} className="font-semibold text-primary dark:text-lavande">
                    {u.open}
                  </Link>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}

async function AccessLabel({ user }: { user: AdminUser }) {
  const [t, locale] = await Promise.all([getT(), getLocale()]);
  const f = adminFormat(locale);
  const u = t.admin.users;
  if (!user.plan_code) {
    return (
      <span className="flex flex-col">
        <span>{u.noAccess}</span>
        <span className="text-xs text-neutral-600 dark:text-neutral-400">{u.trialStates[user.trial_state]}</span>
      </span>
    );
  }
  return (
    <span>
      {user.plan_kind === "essai"
        ? fill(u.trialUntil, { date: f.dateTime(user.access_end) })
        : fill(u.planUntil, { plan: user.plan_label ?? user.plan_code, date: f.date(user.access_end) })}
    </span>
  );
}

async function UserDetail({ user, returnTo, closeHref }: { user: AdminUser; returnTo: string; closeHref: string }) {
  const [t, locale, subscriptions, plans] = await Promise.all([getT(), getLocale(), listSubscriptions(user.user_id), listPlans()]);
  const f = adminFormat(locale);
  const u = t.admin.users;
  const p = t.admin.plans;
  const providers = p.providers as Record<string, string>;
  const country = getCountry(user.country_code);
  const grantable = plans.filter((plan) => plan.kind === "abonnement" && plan.country_code === user.country_code);
  const providerChoices = [...(country?.paymentMethods ?? []), ...MANUAL_PROVIDERS];
  const currency = country?.currency ?? grantable[0]?.currency ?? "XOF";

  return (
    <Card
      title={fill(u.detailTitle, { username: user.username })}
      action={
        <Link href={closeHref} className="text-sm text-primary dark:text-lavande">
          {u.close}
        </Link>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="flex min-w-0 flex-col gap-3">
          <h3 className="text-sm font-semibold">{u.subscriptionsTitle}</h3>
          {subscriptions.length === 0 ? (
            <p className="text-sm text-neutral-600 dark:text-neutral-300">{u.noSubscription}</p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {subscriptions.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
                  <span className="flex flex-col">
                    <strong>
                      {s.plan_label ?? s.plan_code} · {p.statuses[s.status]}
                    </strong>
                    <span className="text-neutral-600 dark:text-neutral-300">
                      {formatMoney(s.amount_minor, s.currency, f.tag)} · {providers[s.payment_provider] ?? s.payment_provider} · {s.payment_reference}
                    </span>
                    <span className="text-xs text-neutral-600 dark:text-neutral-400">
                      {f.date(s.starts_at)} → {f.date(s.ends_at)}
                    </span>
                  </span>
                  {s.status === "active" ? (
                    <form action={cancelSubscriptionAction}>
                      <input type="hidden" name="subscriptionId" value={s.id} />
                      <input type="hidden" name="returnTo" value={returnTo} />
                      <button type="submit" className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-700 dark:border-red-900 dark:text-red-300">
                        {p.cancel}
                      </button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold">{u.grantTitle}</h3>
          <p className="text-xs text-neutral-600 dark:text-neutral-400">{u.grantIntro}</p>
          {grantable.length === 0 ? (
            <p className="text-sm">
              {u.grantNoPlan}{" "}
              <Link href="/admin/forfaits" className="font-semibold text-primary dark:text-lavande">
                {t.admin.nav.plans} →
              </Link>
            </p>
          ) : (
            <form action={grantPlanAction} className="flex flex-col gap-3 text-sm">
              <input type="hidden" name="userId" value={user.user_id} />
              <input type="hidden" name="currency" value={currency} />
              <input type="hidden" name="returnTo" value={returnTo} />
              <label className="flex flex-col gap-1">
                <span className="font-medium">{u.grantPlan}</span>
                <select name="planCode" required className={inputClass}>
                  {grantable.map((plan) => (
                    <option key={plan.code} value={plan.code}>
                      {plan.label} · {formatMoney(plan.price_minor, plan.currency, f.tag)} · {fill(p.days, { n: plan.duration_days })}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-medium">{u.grantProvider}</span>
                <select name="provider" required className={inputClass}>
                  {providerChoices.map((provider) => (
                    <option key={provider} value={provider}>
                      {providers[provider] ?? provider}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-medium">{u.grantReference}</span>
                <input name="reference" required maxLength={80} className={inputClass} />
                <span className="text-xs text-neutral-600 dark:text-neutral-400">{u.grantReferenceHint}</span>
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-medium">{fill(u.grantAmount, { currency })}</span>
                <input name="amount" inputMode="decimal" className={inputClass} />
                <span className="text-xs text-neutral-600 dark:text-neutral-400">{u.grantAmountHint}</span>
              </label>
              <button type="submit" className={buttonClass}>
                {u.grantSubmit}
              </button>
            </form>
          )}
        </div>
      </div>
    </Card>
  );
}
