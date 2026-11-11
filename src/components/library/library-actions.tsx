"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState, type FormEvent } from "react";

import { ConfirmButton } from "@/components/ui/confirm-button";
import { LIBRARY_BUCKET, LIBRARY_MAX_FILE_BYTES, LIBRARY_MIME, titleFromFileName } from "@/config/library";
import { useT } from "@/i18n/client";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { addBookAction, deleteBookAction, type LibraryFormState } from "@/server/library/actions";

type UploadError = "fileType" | "fileTooLarge" | "noSpace" | "uploadFailed" | NonNullable<LibraryFormState["error"]>;

const INPUT =
  "w-full min-w-0 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-base outline-none focus:ring-2 focus:ring-primary dark:border-neutral-700 dark:bg-neutral-950";

/**
 * Ajout d'un livre : le PDF part du navigateur vers le bucket privé (dossier de
 * l'élève, nom aléatoire), puis le serveur l'enregistre ; la base vérifie le
 * forfait et la place restante.
 */
export function UploadBook({ userId, freeBytes, maxLabel }: { userId: string; freeBytes: number | null; maxLabel: string }) {
  const l = useT().library;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [phase, setPhase] = useState<"idle" | "uploading" | "saving">("idle");
  const [error, setError] = useState<UploadError | null>(null);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="rounded-xl bg-primary px-4 py-3 text-center font-semibold text-white">
        + {l.add}
      </button>
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!file || (file.type !== LIBRARY_MIME && !file.name.toLowerCase().endsWith(".pdf"))) return setError("fileType");
    if (file.size > LIBRARY_MAX_FILE_BYTES) return setError("fileTooLarge");
    if (freeBytes !== null && file.size > freeBytes) return setError("noSpace");
    if (!title.trim()) return setError("title");

    const storagePath = `${userId}/${crypto.randomUUID()}.pdf`;
    setPhase("uploading");
    const { error: uploadError } = await createBrowserSupabase()
      .storage.from(LIBRARY_BUCKET)
      .upload(storagePath, file, { contentType: LIBRARY_MIME, upsert: false });
    if (uploadError) {
      setPhase("idle");
      return setError("uploadFailed");
    }
    setPhase("saving");
    const formData = new FormData();
    formData.set("title", title);
    formData.set("storagePath", storagePath);
    const result = await addBookAction({}, formData);
    setPhase("idle");
    if (result.error) return setError(result.error);
    setOpen(false);
    setFile(null);
    setTitle("");
    router.refresh();
  }

  const busy = phase !== "idle";
  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary-soft/40 p-4 dark:bg-primary-strong/10">
      <div className="flex flex-col gap-1 text-sm">
        <label htmlFor="book-file" className="font-medium">
          {l.fileLabel}
        </label>
        <input
          id="book-file"
          type="file"
          accept=".pdf,application/pdf"
          onChange={(e) => {
            const chosen = e.target.files?.[0] ?? null;
            setFile(chosen);
            if (chosen && !title) setTitle(titleFromFileName(chosen.name));
          }}
          className="text-sm"
        />
        <span className="text-xs text-neutral-600 dark:text-neutral-300">{l.fileHint.replace("{max}", maxLabel)}</span>
      </div>
      <div className="flex flex-col gap-1 text-sm">
        <label htmlFor="book-title" className="font-medium">
          {l.titleLabel}
        </label>
        <input id="book-title" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} className={INPUT} />
      </div>
      {error ? (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {l.errors[error].replace("{max}", maxLabel)}
        </p>
      ) : null}
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
          {phase === "uploading" ? l.uploading : phase === "saving" ? l.saving : l.submit}
        </button>
        <button type="button" disabled={busy} onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 text-sm font-medium text-neutral-600 dark:text-neutral-300">
          {l.cancel}
        </button>
      </div>
    </form>
  );
}

/** Suppression d'un livre, confirmée dans la page. */
export function DeleteBook({ id, name }: { id: string; name: string }) {
  const l = useT().library;
  const router = useRouter();
  const [state, action, pending] = useActionState(async (prev: LibraryFormState, formData: FormData) => {
    const result = await deleteBookAction(prev, formData);
    if (result.saved) router.refresh();
    return result;
  }, {});
  return (
    <form action={action} className="flex flex-col gap-1">
      <ConfirmButton
        label={l.delete}
        warning={l.deleteWarning.replace("{name}", name)}
        confirmLabel={l.confirmDelete}
        cancelLabel={l.cancel}
        pending={pending}
        hidden={<input type="hidden" name="id" value={id} />}
      />
      {state.error ? <span role="alert" className="text-xs text-red-700 dark:text-red-400">{l.errors[state.error]}</span> : null}
    </form>
  );
}
