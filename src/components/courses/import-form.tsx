"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { checkFile, isImageMime, resolveMime } from "@/config/documents";
import { LIBRARY_IMPORT_MAX_PAGES } from "@/config/library";
import { useT } from "@/i18n/client";
import { fill } from "@/i18n/format";
import type { ImportErrorKey } from "@/i18n/messages";
import { checkPhotoQuality, type PhotoQuality } from "@/lib/photo-quality";
import { preparePhoto } from "@/lib/prepare-photo";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { registerDocumentAction } from "@/server/courses/actions";
import { importBookAction } from "@/server/library/actions";
import { EXTENSION_BY_MIME, IMPORT_KINDS, NEW, type DocumentKind } from "@/server/courses/schemas";

interface ModuleOption {
  id: string;
  name: string;
  chapters: { id: string; title: string }[];
}

type Phase = "idle" | "preparing" | "uploading" | "registering" | "copying";

const PHASE_LABELS = {
  preparing: "preparingPhoto",
  uploading: "uploading",
  registering: "registering",
  copying: "copying",
} as const;

const DOCUMENT_ACCEPT = ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const PHOTO_ACCEPT = ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp";

const inputClass =
  "rounded-lg border border-neutral-300 bg-white px-3 py-2 text-base outline-none focus:ring-2 focus:ring-primary dark:border-neutral-700 dark:bg-neutral-900";

/**
 * Le fichier part directement du navigateur vers le bucket privé (dossier de
 * l'utilisateur, nom aléatoire), puis le serveur enregistre le document.
 * Une photo est d'abord réduite dans le navigateur ; les photos ne sont
 * proposées que si le service d'IA (qui les lit) est configuré.
 * Avec `book`, pas de fichier à choisir : le serveur copie le livre de
 * « Ma bibliothèque » puis l'importe de la même façon.
 */
export function ImportForm({
  userId,
  modules,
  initialModuleId,
  initialChapterId,
  firstImport,
  photosEnabled,
  book,
}: {
  userId: string;
  modules: ModuleOption[];
  initialModuleId: string;
  initialChapterId: string;
  firstImport: boolean;
  photosEnabled: boolean;
  book?: { id: string; title: string };
}) {
  const t = useT();
  const router = useRouter();
  const [moduleId, setModuleId] = useState(initialModuleId || NEW);
  const [chapterId, setChapterId] = useState(initialChapterId);
  const [kind, setKind] = useState<DocumentKind>("cours");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<ImportErrorKey | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  // Contrôle de netteté d'une photo, tout de suite après la prise de vue.
  const [quality, setQuality] = useState<PhotoQuality | "checking" | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const picked = useRef<File | null>(null);

  const previewUrl = useRef<string | null>(null);

  // L'aperçu est libéré quand on quitte la page.
  useEffect(() => () => {
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
  }, []);

  function pickFile(next: File | null) {
    picked.current = next;
    setFile(next);
    setError(null);
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = next && isPhoto(next) ? URL.createObjectURL(next) : null;
    setPreview(previewUrl.current);
    if (!next || !isPhoto(next) || !photosEnabled) return setQuality(null);
    setQuality("checking");
    void checkPhotoQuality(next).then((result) => {
      // Une autre photo a pu être choisie entre-temps.
      if (picked.current === next) setQuality(result);
    });
  }

  const photoToRetake = quality === "blurry" || quality === "dark";

  const chapters = modules.find((m) => m.id === moduleId)?.chapters ?? [];
  const busy = phase !== "idle";

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(null);
    const target = {
      moduleId,
      newModuleName: String(form.get("newModuleName") ?? ""),
      chapterId,
      newChapterTitle: String(form.get("newChapterTitle") ?? ""),
      kind,
    };

    if (book) {
      setPhase("copying");
      const copied = await importBookAction({
        ...target,
        bookId: book.id,
      }).catch(() => ({ ok: false as const, error: "unknown" as const }));
      if (!copied.ok) {
        setPhase("idle");
        return setError(copied.error);
      }
      return router.push(`/cours/${copied.moduleId}`);
    }

    if (!file) return setError("fileRequired");
    let upload = file;
    const pickedMime = resolveMime(file);
    if (pickedMime && isImageMime(pickedMime)) {
      if (!photosEnabled) return setError("photosUnavailable");
      setPhase("preparing");
      upload = await preparePhoto(file);
    }
    const fileError = checkFile(upload);
    if (fileError) {
      setPhase("idle");
      return setError(fileError);
    }
    const mimeType = resolveMime(upload);
    if (!mimeType) {
      setPhase("idle");
      return setError("fileType");
    }

    const storagePath = `${userId}/${crypto.randomUUID()}.${EXTENSION_BY_MIME[mimeType]}`;
    setPhase("uploading");
    const { error: uploadError } = await createBrowserSupabase()
      .storage.from("documents")
      .upload(storagePath, upload, { contentType: mimeType, upsert: false });
    if (uploadError) {
      setPhase("idle");
      return setError("uploadFailed");
    }

    setPhase("registering");
    const result = await registerDocumentAction({
      ...target,
      fileName: upload.name,
      storagePath,
      mimeType,
      sizeBytes: String(upload.size),
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

      {book ? (
        <div className="flex flex-col gap-1 rounded-xl border border-neutral-300 bg-white p-4 text-sm dark:border-neutral-700 dark:bg-nuit">
          <span className="font-medium text-neutral-600 dark:text-neutral-300">{t.import.book}</span>
          <span className="font-semibold">{book.title}</span>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-neutral-400 bg-white p-6 text-center text-sm dark:bg-nuit">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M4 5a2 2 0 0 1 2-2h9l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
              <path d="M14 3v6h6" />
            </svg>
            <span className="font-semibold">{file ? file.name : photosEnabled ? t.import.chooseFileOrPhoto : t.import.chooseFile}</span>
            <span className="text-neutral-600 dark:text-neutral-300">{photosEnabled ? t.import.formatsWithPhotos : t.import.formats}</span>
            <input
              type="file"
              name="file"
              accept={photosEnabled ? `${DOCUMENT_ACCEPT},${PHOTO_ACCEPT}` : DOCUMENT_ACCEPT}
              className="sr-only"
              onClick={(e) => (e.currentTarget.value = "")}
                onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            />
          </label>
          {photosEnabled ? (
            <label className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-neutral-300 bg-white px-4 text-sm font-semibold dark:border-neutral-700 dark:bg-neutral-900">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M4 8a2 2 0 0 1 2-2h2l2-2h4l2 2h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
                <circle cx="12" cy="13" r="3.5" />
              </svg>
              {t.import.takePhoto}
              <input
                type="file"
                accept={PHOTO_ACCEPT}
                capture="environment"
                className="sr-only"
                onClick={(e) => (e.currentTarget.value = "")}
                onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
              />
            </label>
          ) : null}
          {photosEnabled ? <p className="text-xs text-neutral-600 dark:text-neutral-300">{t.import.photoTips}</p> : null}
        </div>
      )}

      {file && isPhoto(file) ? (
        <div className="flex gap-3 rounded-xl border border-neutral-200 bg-white p-3 text-sm dark:border-neutral-800 dark:bg-nuit">
          {preview ? (
            // Aperçu local (adresse blob:), sans passer par l'optimiseur d'images.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt={t.import.quality.preview} className="size-20 shrink-0 rounded-lg object-cover" />
          ) : null}
          <div className="flex min-w-0 flex-col gap-2" aria-live="polite">
            {quality === "checking" ? <p>{t.import.quality.checking}</p> : null}
            {quality === "ok" ? <p className="font-semibold text-green-700 dark:text-green-400">✓ {t.import.quality.ok}</p> : null}
            {photoToRetake ? (
              <>
                <p className="font-semibold text-orange-800 dark:text-orange-300">{t.import.quality[quality]}</p>
                <label className="flex min-h-11 cursor-pointer items-center justify-center rounded-lg bg-primary px-4 font-semibold text-white">
                  {t.import.quality.retake}
                  <input
                    type="file"
                    accept={PHOTO_ACCEPT}
                    capture="environment"
                    className="sr-only"
                    onClick={(e) => (e.currentTarget.value = "")}
                onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
                  />
                </label>
                <p className="text-xs text-neutral-600 dark:text-neutral-300">{t.import.quality.anywayHint}</p>
              </>
            ) : null}
            {quality === null ? <p>{t.import.photoNotice}</p> : null}
            <button
              type="button"
              onClick={() => pickFile(null)}
              className="self-start text-sm font-medium text-neutral-600 underline underline-offset-2 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white"
            >
              {t.import.quality.cancel}
            </button>
          </div>
        </div>
      ) : null}

      {firstImport ? (
        <p className="rounded-xl bg-orange-50 p-3 text-sm text-orange-900 dark:bg-orange-950 dark:text-orange-100">
          {t.import.trialNotice}
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
          {fill(t.import.errors[error], { max: LIBRARY_IMPORT_MAX_PAGES })}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={busy || quality === "checking"}
        className={`rounded-xl px-4 py-3 font-semibold disabled:opacity-60 ${
          photoToRetake
            ? "border border-neutral-300 bg-white text-neutral-800 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
            : "bg-primary text-white"
        }`}
      >
        {phase !== "idle" ? t.import[PHASE_LABELS[phase]] : photoToRetake ? t.import.quality.importAnyway : t.import.submit}
      </button>
    </form>
  );
}

function isPhoto(file: File): boolean {
  const mime = resolveMime(file);
  return mime !== null && isImageMime(mime);
}
