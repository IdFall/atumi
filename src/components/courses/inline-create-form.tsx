"use client";

import { useActionState } from "react";

import { getMessages } from "@/i18n/messages";
import type { CoursesFormState } from "@/server/courses/actions";

const t = getMessages("fr");

/** Petit formulaire « nom + Créer » pour un module ou un chapitre. */
export function InlineCreateForm({
  action,
  fieldName,
  label,
  placeholder,
  hidden,
}: {
  action: (prev: CoursesFormState, formData: FormData) => Promise<CoursesFormState>;
  fieldName: "name" | "title";
  label: string;
  placeholder: string;
  hidden?: Record<string, string>;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-1 text-sm">
      {Object.entries(hidden ?? {}).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <label className="font-medium" htmlFor={`create-${fieldName}`}>
        {label}
      </label>
      <div className="flex gap-2">
        <input
          id={`create-${fieldName}`}
          name={fieldName}
          required
          maxLength={fieldName === "title" ? 200 : 120}
          placeholder={placeholder}
          aria-invalid={state.error ? true : undefined}
          className="min-w-0 flex-1 rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-base outline-none focus:ring-2 focus:ring-primary dark:border-neutral-700"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-primary px-4 py-2 font-semibold text-white disabled:opacity-60"
        >
          {t.courses.create}
        </button>
      </div>
      {state.error ? (
        <span role="alert" className="text-red-700 dark:text-red-400">
          {t.courses.errors[state.error]}
        </span>
      ) : null}
    </form>
  );
}
