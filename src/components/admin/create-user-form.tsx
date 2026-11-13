"use client";

import { useActionState, useRef, useState } from "react";

import { buttonClass, inputClass, secondaryButtonClass } from "@/components/admin/styles";
import type { Cycle } from "@/config/countries";
import { useT } from "@/i18n/client";
import { createUserAction, type CreateUserState } from "@/server/admin/create-user";
import { ADMIN_CREATE_ROLES, type AdminCreateRole } from "@/server/admin/schemas";

/** Mot de passe provisoire lisible (sans 0/O ni 1/l), 12 caractères. */
function generatePassword(): string {
  const alphabet = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

/** Formulaire « Créer un utilisateur » du back office. */
export function CreateUserForm({
  studentCycles,
  teacherCycles,
  adultAge,
}: {
  studentCycles: readonly Cycle[];
  teacherCycles: readonly Cycle[];
  adultAge: number;
}) {
  const t = useT();
  const c = t.admin.create;
  const formRef = useRef<HTMLFormElement>(null);
  const [role, setRole] = useState<AdminCreateRole>("eleve");
  const [cycle, setCycle] = useState("");
  const [age, setAge] = useState("");
  const [password, setPassword] = useState("");
  const [state, action, pending] = useActionState(async (prev: CreateUserState, formData: FormData) => {
    const result = await createUserAction(prev, formData);
    if (result.created) {
      // Compte créé : le formulaire est vidé pour le suivant.
      formRef.current?.reset();
      setRole("eleve");
      setCycle("");
      setAge("");
      setPassword("");
    }
    return result;
  }, {});

  const cycles = role === "eleve" ? studentCycles : teacherCycles;
  const ageNumber = Number.parseInt(age, 10);
  const minor = role === "eleve" && Number.isFinite(ageNumber) && ageNumber < adultAge;
  const values = state.values ?? {};
  const error = (name: string) => {
    const key = state.errors?.[name];
    return key ? (
      <span role="alert" className="text-xs text-red-700 dark:text-red-400">
        {t.auth.errors[key]}
      </span>
    ) : null;
  };
  const label = "flex flex-col gap-1 text-sm font-medium";

  return (
    <div className="flex flex-col gap-4">
      {state.created ? (
        <div role="status" className="flex flex-col gap-1 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-900 dark:border-green-900 dark:bg-green-950 dark:text-green-100">
          <p className="font-semibold">✓ {c.created}</p>
          <p>
            {state.created.fullName} · {state.created.email} · {c.roles[state.created.role]}
          </p>
          <p>
            {c.temporaryPassword} : <code className="rounded bg-white/70 px-1.5 py-0.5 font-mono dark:bg-black/30">{state.created.password}</code>
          </p>
          <p className="text-xs">{c.passwordHint}</p>
        </div>
      ) : null}
      {state.formError ? (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
          {c.errors[state.formError]}
        </p>
      ) : null}

      <form ref={formRef} action={action} className="grid gap-4 sm:grid-cols-2" noValidate>
        <fieldset className="flex flex-col gap-2 sm:col-span-2">
          <legend className="mb-1 text-sm font-medium">{c.role}</legend>
          <div className="grid grid-cols-3 gap-2">
            {ADMIN_CREATE_ROLES.map((r) => (
              <label
                key={r}
                className={`flex min-h-11 cursor-pointer items-center justify-center rounded-lg border px-2 text-center text-sm ${
                  role === r ? "border-2 border-primary bg-primary-soft font-semibold dark:bg-primary-strong/25" : "border-neutral-300 dark:border-neutral-700"
                }`}
              >
                <input
                  type="radio"
                  name="roleChoice"
                  value={r}
                  checked={role === r}
                  onChange={() => {
                    setRole(r);
                    setCycle("");
                  }}
                  className="sr-only"
                />
                {c.roles[r]}
              </label>
            ))}
          </div>
          {/* Valeur gardée dans un champ caché : React vide les boutons radio après l'envoi. */}
          <input type="hidden" name="role" value={role} />
          <p className="text-xs text-neutral-600 dark:text-neutral-300">{c.roleHints[role]}</p>
        </fieldset>

        <label className={label}>
          {c.fullName}
          <input name="fullName" required maxLength={60} defaultValue={values.fullName} autoComplete="off" className={inputClass} />
          {error("fullName")}
        </label>
        <label className={label}>
          {c.email}
          <input name="email" type="email" required maxLength={254} defaultValue={values.identifier} autoComplete="off" className={inputClass} />
          {error("email")}
        </label>

        <label className={label}>
          {role === "eleve" ? c.studyLevel : c.teachingLevel}
          <select name="cycle" value={cycle} onChange={(e) => setCycle(e.target.value)} className={inputClass}>
            <option value="">{c.chooseLevel}</option>
            {cycles.map((cy) => (
              <option key={cy} value={cy}>
                {t.auth.cycles[cy]}
              </option>
            ))}
          </select>
          {error("cycle")}
        </label>
        <label className={label}>
          {c.age}
          <input name="age" inputMode="numeric" maxLength={3} value={age} onChange={(e) => setAge(e.target.value)} className={inputClass} />
          {error("age")}
        </label>

        {minor ? (
          <label className={`${label} sm:col-span-2`}>
            {c.guardianPhone}
            <input name="guardianPhone" type="tel" defaultValue={values.guardianPhone} placeholder="77 123 45 67" className={inputClass} />
            <span className="text-xs font-normal text-neutral-600 dark:text-neutral-300">{c.guardianHint}</span>
            {error("guardianPhone")}
          </label>
        ) : null}

        <label className={`${label} sm:col-span-2`}>
          {c.password}
          <div className="flex gap-2">
            <input
              name="password"
              type="text"
              required
              minLength={8}
              maxLength={72}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              className={`${inputClass} min-w-0 flex-1 font-mono`}
            />
            <button type="button" onClick={() => setPassword(generatePassword())} className={secondaryButtonClass}>
              {c.generate}
            </button>
          </div>
          {error("password")}
        </label>

        <div className="sm:col-span-2">
          <button type="submit" disabled={pending} className={`${buttonClass} disabled:opacity-60`}>
            {pending ? c.creating : c.submit}
          </button>
        </div>
      </form>
    </div>
  );
}
