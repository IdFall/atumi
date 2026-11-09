"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { checkFile, resolveMime } from "@/config/documents";
import { useT } from "@/i18n/client";
import type { ImportErrorKey } from "@/i18n/messages";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { registerDocumentAction } from "@/server/courses/actions";
import { EXTENSION_BY_MIME, IMPORT_KINDS, NEW, type DocumentKind } from "@/server/courses/schemas";

interface ModuleOption {
  id: string;
  name: string;
  chapters: { id: string; title: string }[];
}

type Phase = "idle" | "uploading" | "registering";

const inputClass =
  "rounded-lg border border-neutral-300 bg-white px-3 py-2 text-base outline-none focus:ring-2 focus:ring-primary dark:border-neutral-700 dark:bg-neutral-900";

/**
 * Le fichier part directement du navigateur vers le bucket privé (dossier de
 * l'utilisateur, nom aléatoire), puis le serveur enregistre le document.
 */
export function ImportForm({
  userId,
  modules,
  initialModuleId,
  initialChapterId,
  firstImport,
}: {
  userId: string;
  modules: ModuleOption[];
  initialModuleId: string;
  initialChapterId: string;
  firstImport: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const [moduleId, setModuleId] = useState(initialModuleId || NEW);
  const [chapterId, setChapterId] = useState(initialChapterId);
  const [kind, setKind] = useState<DocumentKind>("cours");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<ImportErrorKey | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");

  const chapters = modules.find((m) => m.id === moduleId)?.chapters ?? [];
  const busy = phase !== "idle";

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(null);

    if (!file) return setError("fileRequired");
    const fileError = checkFile(file);
    if (fileError) return setError(fileError);
    const mimeType = resolveMime(file);
    if (!mimeType) return setError("fileType");

    const storagePath = `${userId}/${crypto.randomUUID()}.${EXTENSION_BY_MIME[mimeType]}`;
    setPhase("uploading");
    const { error: uploadError } = await createBrowserSupabase()
      .storage.from("documents")
      .upload(storagePath, file, { contentType: mimeType, upsert: false });
    if (uploadError) {
      setPhase("idle");
      return setError("uploadFailed");
    }

    setPhase("registering");
    const result = await registerDocumentAction({
      moduleId,
      newModuleName: String(form.get("newModuleName") ?? ""),
      chapterId,
      newChapterTitle: String(form.get("newChapterTitle") ?? ""),
      kind,
      fileName: file.name,
      storagePath,
      mimeType,
      sizeBytes: String(file.size),
    }).catch(() => ({ ok: false as const, error: "unknown" as const }));

    if (!result.ok) {
      setPhase("idle");
      return setError(result.error);
    }
    router.push(`/cours/${result.moduleId}`);
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">{t.import.module}</span>
        <select
          className={inputClass}
          value={moduleId}
          onChange={(e) => {
            setModuleId(e.target.value);
            setChapterId("");
          }}
        >
          {modules.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
          <option value={NEW}>{t.import.newModuleOption}</option>
        </select>
      </label>
      {moduleId === NEW ? (
        <label className="-mt-3 flex flex-col gap-1 text-sm">
          <span className="font-medium">{t.courses.newModuleName}</span>
          <input name="newModuleName" required maxLength={120} placeholder={t.courses.newModulePlaceholder} className={inputClass} />
        </label>
      ) : null}

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">{t.import.chapter}</span>
        <select className={inputClass} value={chapterId} onChange={(e) => setChapterId(e.target.value)}>
          <option value="">{t.import.noChapterOption}</option>
          {chapters.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
          <option value={NEW}>{t.import.newChapterOption}</option>
        </select>
      </label>
      {chapterId === NEW ? (
        <label className="-mt-3 flex flex-col gap-1 text-sm">
          <span className="font-medium">{t.courses.newChapterTitle}</span>
          <input name="newChapterTitle" required maxLength={200} placeholder={t.courses.newChapterPlaceholder} className={inputClass} />
        </label>
      ) : null}

      <fieldset className="flex flex-col gap-2 text-sm">
        <legend className="mb-2 font-medium">{t.import.kind}</legend>
        <div className="grid grid-cols-3 gap-2">
          {IMPORT_KINDS.map((k) => (
            <label
              key={k}
              className={`flex min-h-11 cursor-pointer items-center justify-center rounded-lg border px-2 text-center ${
                kind === k
                  ? "border-2 border-primary bg-primary-soft font-semibold dark:bg-primary-strong/25"
                  : "border-neutral-300 bg-white dark:border-neutral-700 dark:bg-neutral-900"
              }`}
            >
              <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="sr-only" />
              {t.courses.kinds[k]}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-neutral-400 bg-white p-6 text-center text-sm dark:bg-nuit">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 5a2 2 0 0 1 2-2h9l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
          <path d="M14 3v6h6" />
        </svg>
        <span className="font-semibold">{file ? file.name : t.import.chooseFile}</span>
        <span className="text-neutral-600 dark:text-neutral-300">{t.import.formats}</span>
        <input
          type="file"
          name="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="sr-only"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setError(null);
          }}
        />
      </label>

      {firstImport ? (
        <p className="rounded-xl bg-orange-50 p-3 text-sm text-orange-900 dark:bg-orange-950 dark:text-orange-100">
          {t.import.trialNotice}
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
          {t.import.errors[error]}
        </p>
      ) : null}

      <button type="submit" disabled={busy} className="rounded-xl bg-primary px-4 py-3 font-semibold text-white disabled:opacity-60">
        {phase === "uploading" ? t.import.uploading : phase === "registering" ? t.import.registering : t.import.submit}
      </button>
    </form>
  );
}
