"use client";

import { useActionState } from "react";

import { useT } from "@/i18n/client";
import { requestPaymentAction, type PaymentRequestState } from "@/server/billing/actions";

/** Déclaration d'un paiement mobile money (forfait, moyen, référence). */
export function PaymentForm({
  plans,
  providers,
  defaultCode,
}: {
  plans: readonly { code: string; label: string }[];
  providers: readonly { id: string; label: string }[];
  /** Forfait ou recharge choisi sur la page. */
  defaultCode?: string;
}) {
  const t = useT();
  const s = t.subscribe;
  const [state, formAction, pending] = useActionState<PaymentRequestState, FormData>(requestPaymentAction, {});
  if (state.sent) {
    return (
      <p role="status" className="rounded-xl bg-green-50 p-4 text-sm text-green-800 dark:bg-green-950 dark:text-green-100">
        {s.sent}
      </p>
    );
  }
  const control =
    "rounded-lg border border-neutral-300 bg-white px-3 py-2 text-base outline-none focus:ring-2 focus:ring-primary dark:border-neutral-700 dark:bg-neutral-900";
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">{s.plan}</span>
        <select key={defaultCode} name="planCode" required disabled={pending} defaultValue={defaultCode} className={control}>
          {plans.map((p) => (
            <option key={p.code} value={p.code}>
              {p.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">{s.provider}</span>
        <select name="provider" required disabled={pending} className={control}>
          {providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">{s.reference}</span>
        <input name="reference" required minLength={3} maxLength={80} disabled={pending} autoComplete="off" className={control} />
        <span className="text-neutral-600 dark:text-neutral-400">{s.referenceHint}</span>
      </label>
      {state.error ? (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {s.errors[state.error]}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className="rounded-xl bg-primary px-4 py-3 font-semibold text-white disabled:opacity-60">
        {s.send}
      </button>
    </form>
  );
}
