"use client";

import { useActionState } from "react";

import { Field, FormMessage, SubmitButton, TextInput } from "@/components/ui/form";
import { useT } from "@/i18n/client";
import { verifyPhoneAction, type FormState } from "@/server/auth/actions";

export function VerifyPhoneForm({ phone }: { phone: string }) {
  const t = useT();
  const [state, formAction, pending] = useActionState<FormState, FormData>(verifyPhoneAction, {});

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {state.formError ? <FormMessage tone="error">{t.auth.errors[state.formError]}</FormMessage> : null}
      <input type="hidden" name="telephone" value={phone} />
      <Field label={t.auth.fields.code}>
        <TextInput name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={8} required />
      </Field>
      <SubmitButton pending={pending}>{t.auth.submitVerify}</SubmitButton>
    </form>
  );
}
