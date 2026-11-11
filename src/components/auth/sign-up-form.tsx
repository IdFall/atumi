"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { Field, FormMessage, SubmitButton, TextInput } from "@/components/ui/form";
import { defaultCountry, requiresParentalConsent, type Cycle } from "@/config/countries";
import { useT } from "@/i18n/client";
import { signUpAction, type FormState } from "@/server/auth/actions";

const CYCLES = defaultCountry().openCycles;

export function SignUpForm() {
  const t = useT();
  const [state, formAction, pending] = useActionState<FormState, FormData>(signUpAction, {});
  const [role, setRole] = useState<string>(state.values?.role === "enseignant" ? "enseignant" : "eleve");
  const [cycle, setCycle] = useState<string>(state.values?.cycle ?? "");
  const [adult, setAdult] = useState<boolean>(state.values?.isAdult === "on");
  const err = (name: string) => {
    const key = state.errors?.[name];
    return key ? t.auth.errors[key] : undefined;
  };

  if (state.notice === "checkEmail") {
    return <FormMessage tone="info">{t.auth.checkEmail}</FormMessage>;
  }

  const teacher = role === "enseignant";
  const minor = !teacher && CYCLES.includes(cycle as Cycle) && requiresParentalConsent(cycle as Cycle);
  const choice = (on: boolean) =>
    `cursor-pointer rounded-lg border px-2 py-2 text-center ${
      on ? "border-primary bg-primary-soft font-semibold dark:bg-primary-strong/25" : "border-neutral-300 dark:border-neutral-700"
    }`;

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
        <legend className="mb-1 font-medium">{t.auth.fields.role}</legend>
        <div className="grid grid-cols-2 gap-2">
          {(["eleve", "enseignant"] as const).map((value) => (
            <label key={value} className={choice(role === value)}>
              <input type="radio" name="role" value={value} className="sr-only" checked={role === value} onChange={() => setRole(value)} />
              {t.auth.roles[value]}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2 text-sm">
        <legend className="mb-1 font-medium">{teacher ? t.auth.fields.cycleTeacher : t.auth.fields.cycle}</legend>
        <div className="grid grid-cols-2 gap-2">
          {CYCLES.map((value) => (
            <label key={value} className={choice(cycle === value)}>
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
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="isAdult"
            className="mt-1"
            checked={adult}
            onChange={(event) => setAdult(event.target.checked)}
          />
          <span>{t.auth.fields.isAdult}</span>
        </label>
      ) : null}

      {minor && !adult ? (
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
        <span>
          {t.auth.fields.acceptCgu.split(/(\{terms\}|\{privacy\})/).map((part, i) =>
            part === "{terms}" || part === "{privacy}" ? (
              <Link
                key={i}
                href={part === "{terms}" ? "/conditions" : "/confidentialite"}
                target="_blank"
                className="text-primary underline dark:text-lavande"
              >
                {part === "{terms}" ? t.auth.fields.acceptCguTerms : t.auth.fields.acceptCguPrivacy}
              </Link>
            ) : (
              part
            ),
          )}
        </span>
      </label>
      {err("acceptCgu") ? (
        <span className="text-sm text-red-700 dark:text-red-400" role="alert">
          {err("acceptCgu")}
        </span>
      ) : null}

      <SubmitButton pending={pending}>{t.auth.submitSignUp}</SubmitButton>
      <Link href="/connexion" className="text-center text-sm text-primary dark:text-lavande underline">
        {t.auth.toSignIn}
      </Link>
    </form>
  );
}
