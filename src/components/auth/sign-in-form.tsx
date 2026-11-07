"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Field, FormMessage, SubmitButton, TextInput } from "@/components/ui/form";
import { getMessages } from "@/i18n/messages";
import { signInAction, type FormState } from "@/server/auth/actions";

const t = getMessages("fr");

export function SignInForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(signInAction, {});
  const err = (name: string) => {
    const key = state.errors?.[name];
    return key ? t.auth.errors[key] : undefined;
  };

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {state.formError ? <FormMessage tone="error">{t.auth.errors[state.formError]}</FormMessage> : null}

      <Field label={t.auth.fields.identifier} error={err("identifier")}>
        <TextInput
          name="identifier"
          autoComplete="username"
          autoCapitalize="none"
          defaultValue={state.values?.identifier}
          invalid={Boolean(err("identifier"))}
          required
        />
      </Field>

      <Field label={t.auth.fields.password} error={err("password")}>
        <TextInput
          name="password"
          type="password"
          autoComplete="current-password"
          invalid={Boolean(err("password"))}
          required
        />
      </Field>

      <Link href="/mot-de-passe-oublie" className="-mt-2 self-end text-sm text-primary underline dark:text-lavande">
        {t.auth.forgotPassword}
      </Link>

      <SubmitButton pending={pending}>{t.auth.submitSignIn}</SubmitButton>
      <Link href="/inscription" className="text-center text-sm text-primary dark:text-lavande underline">
        {t.auth.toSignUp}
      </Link>
    </form>
  );
}
