"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Field, FormMessage, SubmitButton, TextInput } from "@/components/ui/form";
import { useT } from "@/i18n/client";
import { resendConfirmationAction, signInAction, type FormState } from "@/server/auth/actions";

export function SignInForm() {
  const t = useT();
  const [state, formAction, pending] = useActionState<FormState, FormData>(signInAction, {});
  const err = (name: string) => {
    const key = state.errors?.[name];
    return key ? t.auth.errors[key] : undefined;
  };

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {state.formError ? <FormMessage tone="error">{t.auth.errors[state.formError]}</FormMessage> : null}
      {state.formError === "emailNotConfirmed" ? <ResendConfirmation /> : null}

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

/** Compte e-mail pas encore confirmé : renvoie le lien d'activation à l'adresse saisie au-dessus. */
function ResendConfirmation() {
  const t = useT();
  const [state, resendAction, pending] = useActionState<FormState, FormData>(resendConfirmationAction, {});
  if (state.notice === "confirmationResent") return <FormMessage tone="info">{t.auth.confirmationResent}</FormMessage>;
  return (
    <button
      type="submit"
      formAction={resendAction}
      formNoValidate
      disabled={pending}
      className="-mt-2 self-start text-sm font-semibold text-primary underline disabled:opacity-60 dark:text-lavande"
    >
      {t.auth.resendConfirmation}
    </button>
  );
}
