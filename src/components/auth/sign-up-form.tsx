"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";

import { Field, FormMessage, SubmitButton, TextInput } from "@/components/ui/form";
import { defaultCountry, isAdultAge, parseAge, type Cycle } from "@/config/countries";
import { useT } from "@/i18n/client";
import { signUpAction, type FormState } from "@/server/auth/actions";

/** Niveaux proposés : lycée et université pour un élève ; du primaire à l'université pour un enseignant. */
const STUDENT_CYCLES = defaultCountry().openCycles;
const TEACHER_CYCLES = defaultCountry().teacherCycles;
const COUNTRY = defaultCountry();

export function SignUpForm() {
  const t = useT();
  const [state, formAction, pending] = useActionState<FormState, FormData>(signUpAction, {});
  const [role, setRole] = useState<string>(state.values?.role === "enseignant" ? "enseignant" : "eleve");
  // Lien « Créer mon compte enseignant » (/inscription?role=enseignant) : lu après le premier rendu,
  // la page d'inscription reste statique.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!state.values && new URLSearchParams(window.location.search).get("role") === "enseignant") setRole("enseignant");
  }, [state.values]);
  const [cycle, setCycle] = useState<string>(state.values?.cycle ?? "");
  const [ageText, setAgeText] = useState<string>(state.values?.age ?? "");
  const err = (name: string) => {
    const key = state.errors?.[name];
    return key ? t.auth.errors[key] : undefined;
  };

  if (state.notice === "checkEmail") {
    return <FormMessage tone="info">{t.auth.checkEmail}</FormMessage>;
  }

  const teacher = role === "enseignant";
  const cycles = teacher ? TEACHER_CYCLES : STUDENT_CYCLES;
  // Âge déclaré : un élève mineur donne le numéro d'un parent, ou ne peut pas
  // s'inscrire si le pays ferme l'inscription aux mineurs (le serveur vérifie aussi).
  const age = parseAge(ageText);
  const minor = age !== null && !isAdultAge(COUNTRY, age);
  const minorClosed = minor && !teacher && COUNTRY.minorSignUp === "closed";
  const needsGuardian = minor && !teacher && COUNTRY.minorSignUp === "parental_notice";
  const choice = (on: boolean) =>
    `cursor-pointer rounded-lg border px-2 py-2 text-center ${
      on ? "border-primary bg-primary-soft font-semibold dark:bg-primary-strong/25" : "border-neutral-300 dark:border-neutral-700"
    }`;

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {state.formError ? <FormMessage tone="error">{t.auth.errors[state.formError]}</FormMessage> : null}

      <Field label={t.auth.fields.fullName} hint={t.auth.fields.fullNameHint} error={err("fullName")}>
        <TextInput
          name="fullName"
          autoComplete="name"
          autoCapitalize="words"
          maxLength={60}
          defaultValue={state.values?.fullName}
          invalid={Boolean(err("fullName"))}
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

      <Field label={t.auth.fields.passwordConfirm} error={err("passwordConfirm")}>
        <TextInput
          name="passwordConfirm"
          type="password"
          autoComplete="new-password"
          minLength={8}
          invalid={Boolean(err("passwordConfirm"))}
          required
        />
      </Field>

      <Field label={t.auth.fields.age} hint={t.auth.fields.ageHint} error={err("age")}>
        <TextInput
          name="age"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={3}
          autoComplete="off"
          value={ageText}
          onChange={(event) => setAgeText(event.target.value.replace(/[^0-9]/g, ""))}
          invalid={Boolean(err("age"))}
          required
        />
      </Field>
      {minorClosed && !err("age") ? <FormMessage tone="error">{t.auth.errors.minorClosed}</FormMessage> : null}
      {minor && teacher && !err("age") ? <FormMessage tone="error">{t.auth.errors.teacherMinor}</FormMessage> : null}

      {/* Rôle et niveau partent par ces champs cachés : après un envoi refusé,
          React vide les boutons radio du formulaire alors que le choix reste affiché. */}
      <input type="hidden" name="role" value={role} />
      <input type="hidden" name="cycle" value={cycle} />

      <fieldset className="flex flex-col gap-2 text-sm">
        <legend className="mb-1 font-medium">{t.auth.fields.role}</legend>
        <div className="grid grid-cols-2 gap-2">
          {(["eleve", "enseignant"] as const).map((value) => (
            <label key={value} className={choice(role === value)}>
              <input type="radio" name="roleChoice" value={value} className="sr-only" checked={role === value} onChange={() => {
                  setRole(value);
                  // Un niveau réservé aux enseignants (primaire, collège…) n'est plus proposé à un élève.
                  if (value === "eleve" && !STUDENT_CYCLES.includes(cycle as Cycle)) setCycle("");
                }}
              />
              {t.auth.roles[value]}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2 text-sm">
        <legend className="mb-1 font-medium">{teacher ? t.auth.fields.cycleTeacher : t.auth.fields.cycle}</legend>
        <div className="grid grid-cols-2 gap-2">
          {cycles.map((value) => (
            <label key={value} className={choice(cycle === value)}>
              <input
                type="radio"
                name="cycleChoice"
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

      {needsGuardian ? (
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
