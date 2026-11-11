"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";

import { ConfirmButton } from "@/components/ui/confirm-button";
import { LIBRARY_BUCKET, LIBRARY_MAX_FILE_BYTES, LIBRARY_MIME, titleFromFileName } from "@/config/library";
import { useT } from "@/i18n/client";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { addBookAction, deleteBookAction, type LibraryFormState } from "@/server/library/actions";

type UploadError = "fileType" | "fileTooLarge" | "noSpace" | "uploadFailed" | NonNullable<LibraryFormState["error"]>;

/**
 * Ajout d'un livre en un geste : le bouton ouvre le choix du fichier, et le PDF
 * part aussitôt du navigateur vers le bucket privé (dossier de l'élève, nom
 * aléatoire). Le titre vient du nom du fichier. Le serveur l'enregistre ensuite ;
 * la base vérifie le forfait et la place restante.
 */
export function UploadBook({ userId, freeBytes, maxLabel }: { userId: string; freeBytes: number | null; maxLabel: string }) {
  const l = useT().library;
  const router = useRouter();
  const [phase, setPhase] = useState<"idle" | "uploading" | "saving">("idle");
  const [error, setError] = useState<UploadError | null>(null);

  async function upload(file: File) {
    setError(null);
    if (file.type !== LIBRARY_MIME && !file.name.toLowerCase().endsWith(".pdf")) return setError("fileType");
    if (file.size > LIBRARY_MAX_FILE_BYTES) return setError("fileTooLarge");
    if (freeBytes !== null && file.size > freeBytes) return setError("noSpace");

    const storagePath = `${userId}/${crypto.randomUUID()}.pdf`;
    setPhase("uploading");
    try {
      const { error: uploadError } = await createBrowserSupabase()
        .storage.from(LIBRARY_BUCKET)
        .upload(storagePath, file, { contentType: LIBRARY_MIME, upsert: false });
      if (uploadError) {
        console.error("[bibliotheque] dépôt refusé", uploadError.message);
        setPhase("idle");
        return setError("uploadFailed");
      }
      setPhase("saving");
      const formData = new FormData();
      formData.set("title", titleFromFileName(file.name));
      formData.set("storagePath", storagePath);
      const result = await addBookAction({}, formData);
      setPhase("idle");
      if (result.error) return setError(result.error);
      router.refresh();
    } catch (cause) {
      console.error("[bibliotheque] ajout impossible", cause);
      setPhase("idle");
      setError("uploadFailed");
    }
  }

  const busy = phase !== "idle";
  return (
    <div className="flex flex-col gap-1">
      <label
        className={`flex min-h-12 cursor-pointer items-center justify-center rounded-xl bg-primary px-4 py-3 text-center font-semibold text-white ${busy ? "pointer-events-none opacity-60" : ""}`}
      >
        {phase === "uploading" ? l.uploading : phase === "saving" ? l.saving : `+ ${l.add}`}
        <input
          type="file"
          accept=".pdf,application/pdf"
          disabled={busy}
          className="sr-only"
          onChange={(e) => {
            const chosen = e.target.files?.[0];
            e.target.value = "";
            if (chosen) void upload(chosen);
          }}
        />
      </label>
      <span className="text-xs text-neutral-600 dark:text-neutral-300">{l.fileHint.replace("{max}", maxLabel)}</span>
      {error ? (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {l.errors[error].replace("{max}", maxLabel)}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Téléchargement d'un livre (abonnés) : le fichier est lu par la page puis
 * enregistré par le navigateur. Plus sûr qu'un simple lien quand ATUMI est
 * installée sur l'écran d'accueil du téléphone, où un lien de téléchargement
 * peut rester sans effet.
 */
export function DownloadBook({ bookId, fileName, className }: { bookId: string; fileName: string; className: string }) {
  const l = useT().library;
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const href = `/api/bibliotheque/${bookId}?telecharger=1`;

  async function download(event: React.MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    setBusy(true);
    setFailed(false);
    try {
      const response = await fetch(href, { credentials: "same-origin" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (cause) {
      console.error("[bibliotheque] téléchargement impossible", cause);
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col">
      <a href={href} download={fileName} onClick={download} aria-busy={busy} className={className}>
        {busy ? l.downloading : l.download}
      </a>
      {failed ? <span role="alert" className="text-xs text-red-700 dark:text-red-400">{l.downloadFailed}</span> : null}
    </span>
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
