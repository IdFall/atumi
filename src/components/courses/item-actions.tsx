"use client";

import { useActionState, useState } from "react";

import { getMessages } from "@/i18n/messages";
import type { CoursesFormState } from "@/server/courses/actions";
import { deleteItemAction, renameItemAction, type ManagedItem } from "@/server/courses/manage";

const t = getMessages("fr");

/** Boutons « Modifier » et « Supprimer » d'un module, d'un chapitre ou d'un document. */
export function ItemActions({
  kind,
  id,
  moduleId,
  name,
}: {
  kind: ManagedItem;
  id: string;
  moduleId: string;
  name: string;
}) {
  const m = t.courses.manage;
  const [editing, setEditing] = useState(false);
  const [renameState, renameAction, renaming] = useActionState(async (prev: CoursesFormState, formData: FormData) => {
    const result = await renameItemAction(prev, formData);
    if (result.saved) setEditing(false);
    return result;
  }, {});
  const [deleteState, deleteAction, deleting] = useActionState(deleteItemAction, {} as CoursesFormState);

  const hidden = (
    <>
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="moduleId" value={moduleId} />
    </>
  );
  const error = renameState.error ?? deleteState.error;

  if (editing) {
    return (
      <form action={renameAction} className="flex flex-col gap-1 text-sm">
        {hidden}
        <label className="sr-only" htmlFor={`rename-${id}`}>
          {m.newName}
        </label>
        <div className="flex gap-2">
          <input
            id={`rename-${id}`}
            name="name"
            required
            autoFocus
            defaultValue={name}
            maxLength={kind === "module" ? 120 : 200}
            className="min-w-0 flex-1 rounded-lg border border-neutral-300 bg-transparent px-3 py-1.5 text-base outline-none focus:ring-2 focus:ring-primary dark:border-neutral-700"
          />
          <button type="submit" disabled={renaming} className="rounded-lg bg-primary px-3 py-1.5 font-semibold text-white disabled:opacity-60">
            {m.save}
          </button>
          <button type="button" onClick={() => setEditing(false)} className="rounded-lg px-2 py-1.5 text-neutral-600 dark:text-neutral-300">
            {m.cancel}
          </button>
        </div>
        {error ? (
          <span role="alert" className="text-red-700 dark:text-red-400">
            {t.courses.errors[error]}
          </span>
        ) : null}
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-1 text-xs">
      <div className="flex gap-3">
        <button type="button" onClick={() => setEditing(true)} className="font-medium text-primary dark:text-lavande">
          {m.edit}
        </button>
        <form
          action={deleteAction}
          onSubmit={(event) => {
            if (!window.confirm(m.confirm[kind].replace("{name}", name))) event.preventDefault();
          }}
        >
          {hidden}
          <button type="submit" disabled={deleting} className="font-medium text-red-700 disabled:opacity-60 dark:text-red-400">
            {deleting ? m.deleting : m.delete}
          </button>
        </form>
      </div>
      {error ? (
        <span role="alert" className="text-red-700 dark:text-red-400">
          {t.courses.errors[error]}
        </span>
      ) : null}
    </div>
  );
}
