"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Field, FormMessage, SubmitButton, TextInput } from "@/components/ui/form";
import { getMessages } from "@/i18n/messages";
import { requestPasswordResetAction, updatePasswordAction, type FormState } from "@/server/auth/actions";

const t = getMessages("fr");

function errorOf(state: FormState, name: string) {
  const key = state.errors?.[name];
  return key ? t.auth.errors[key] : undefined;
}

export function ResetRequestForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(requestPasswordResetAction, {});

  if (state.notice === "resetSent") {
    return (
      <div className="flex flex-col gap-4">
        <FormMessage tone="info">{t.auth.resetSent}</FormMessage>
        <Link href="/connexion" className="text-center text-sm text-primary underline dark:text-lavande">
          {t.auth.backToSignIn}
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <p className="text-sm text-neutral-600 dark:text-neutral-300">{t.auth.resetIntro}</p>
      {state.formError ? <FormMessage tone="error">{t.auth.errors[state.formError]}</FormMessage> : null}
      <Field label={t.auth.fields.identifier} error={errorOf(state, "identifier")}>
        <TextInput
          name="identifier"
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          defaultValue={state.values?.identifier}
          invalid={Boolean(errorOf(state, "identifier"))}
          required
        />
      </Field>
      <SubmitButton pending={pending}>{t.auth.resetSubmit}</SubmitButton>
      <Link href="/connexion" className="text-center text-sm text-primary underline dark:text-lavande">
        {t.auth.backToSignIn}
      </Link>
    </form>
  );
}

export function NewPasswordForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(updatePasswordAction, {});

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {state.formError ? (
        <FormMessage tone="error">
          {t.auth.errors[state.formError]}{" "}
          {state.formError === "resetLinkExpired" ? (
            <Link href="/mot-de-passe-oublie" className="underline">
              {t.auth.forgotPassword}
            </Link>
          ) : null}
        </FormMessage>
      ) : null}
      <Field label={t.auth.fields.password} hint={t.auth.fields.passwordHint} error={errorOf(state, "password")}>
        <TextInput
          name="password"
          type="password"
          autoComplete="new-password"
          invalid={Boolean(errorOf(state, "password"))}
          required
        />
      </Field>
      <SubmitButton pending={pending}>{t.auth.newPasswordSubmit}</SubmitButton>
    </form>
  );
}
