"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { Field, FormMessage, SubmitButton, TextInput } from "@/components/ui/form";
import { requiresParentalConsent, type Cycle } from "@/config/countries";
import { getMessages } from "@/i18n/messages";
import { signUpAction, type FormState } from "@/server/auth/actions";

const t = getMessages("fr");
const CYCLES: Cycle[] = ["college", "lycee", "universite"];

export function SignUpForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(signUpAction, {});
  const [cycle, setCycle] = useState<string>(state.values?.cycle ?? "");
  const err = (name: string) => {
    const key = state.errors?.[name];
    return key ? t.auth.errors[key] : undefined;
  };

  if (state.notice === "checkEmail") {
    return <FormMessage tone="info">{t.auth.checkEmail}</FormMessage>;
  }

  const minor = CYCLES.includes(cycle as Cycle) && requiresParentalConsent(cycle as Cycle);

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {state.formError ? <FormMessage tone="error">{t.auth.errors[state.formError]}</FormMessage> : null}

      <Field label={t.auth.fields.username} hint={t.auth.fields.usernameHint} error={err("username")}>
        <TextInput
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          defaultValue={state.values?.username}
          invalid={Boolean(err("username"))}
          required
        />
      </Field>

      <Field label={t.auth.fields.identifier} error={err("identifier")}>
        <TextInput
          name="identifier"
          autoComplete="email"
          autoCapitalize="none"
          defaultValue={state.values?.identifier}
          invalid={Boolean(err("identifier"))}
          required
        />
      </Field>

      <Field label={t.auth.fields.password} hint={t.auth.fields.passwordHint} error={err("password")}>
        <TextInput
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          invalid={Boolean(err("password"))}
          required
        />
      </Field>

      <fieldset className="flex flex-col gap-2 text-sm">
        <legend className="mb-1 font-medium">{t.auth.fields.cycle}</legend>
        <div className="grid grid-cols-3 gap-2">
          {CYCLES.map((value) => (
            <label
              key={value}
              className={`cursor-pointer rounded-lg border px-2 py-2 text-center ${
                cycle === value
                  ? "border-blue-700 bg-blue-50 font-semibold dark:bg-blue-950"
                  : "border-neutral-300 dark:border-neutral-700"
              }`}
            >
              <input
                type="radio"
                name="cycle"
                value={value}
                className="sr-only"
                checked={cycle === value}
                onChange={() => setCycle(value)}
              />
              {t.auth.cycles[value]}
            </label>
          ))}
        </div>
        {err("cycle") ? (
          <span className="text-red-700 dark:text-red-400" role="alert">
            {err("cycle")}
          </span>
        ) : null}
      </fieldset>

      {minor ? (
        <Field
          label={t.auth.fields.guardianPhone}
          hint={t.auth.fields.guardianPhoneHint}
          error={err("guardianPhone")}
        >
          <TextInput
            name="guardianPhone"
            type="tel"
            autoComplete="off"
            defaultValue={state.values?.guardianPhone}
            invalid={Boolean(err("guardianPhone"))}
            required
          />
        </Field>
      ) : null}

      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="acceptCgu" className="mt-1" required />
        <span>{t.auth.fields.acceptCgu}</span>
      </label>
      {err("acceptCgu") ? (
        <span className="text-sm text-red-700 dark:text-red-400" role="alert">
          {err("acceptCgu")}
        </span>
      ) : null}

      <SubmitButton pending={pending}>{t.auth.submitSignUp}</SubmitButton>
      <Link href="/connexion" className="text-center text-sm text-blue-700 underline">
        {t.auth.toSignIn}
      </Link>
    </form>
  );
}
