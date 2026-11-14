"use client";

import { useEffect, useRef, useState } from "react";

import { useLocale, useT } from "@/i18n/client";
import { fill } from "@/i18n/format";
import { READ_SPEEDS, splitForReading, voiceLang } from "@/lib/read-aloud";

type Kind = "pdf" | "docx";
type Status = "idle" | "preparing" | "playing" | "paused" | "noText" | "unsupported" | "failed";

interface Piece {
  page: number;
  text: string;
}

/** Texte du document, page par page (une seule « page » pour un Word). */
async function extractPages(kind: Kind, url: string): Promise<string[]> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Téléchargement impossible : ${response.status}`);
  const bytes = await response.arrayBuffer();
  if (kind === "docx") {
    const mammoth = await import("mammoth");
    const { value } = await mammoth.extractRawText({ arrayBuffer: bytes });
    return [value];
  }
  const { getDocumentProxy } = await import("unpdf");
  const doc = await getDocumentProxy(new Uint8Array(bytes));
  const pages: string[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    pages.push(
      content.items
        .map((item) => ("str" in item ? `${item.str}${item.hasEOL ? "\n" : ""}` : ""))
        .join(""),
    );
    page.cleanup();
  }
  await doc.cleanup();
  return pages;
}

/**
 * Lecture audio d'un PDF ou d'un Word : la voix du navigateur lit le texte,
 * sans envoi à un serveur ni décompte du forfait. Le texte n'est extrait
 * qu'au premier appui sur « Écouter ».
 */
export function ReadAloud({ kind, url }: { kind: Kind; url: string }) {
  const t = useT();
  const r = t.viewer.listen;
  const [locale, setLocale] = useState(useLocale());
  const [status, setStatus] = useState<Status>("idle");
  const [rate, setRate] = useState<number>(1);
  const [pages, setPages] = useState<string[] | null>(null);
  const [startPage, setStartPage] = useState(1);
  const [current, setCurrent] = useState<Piece | null>(null);
  const queue = useRef<Piece[]>([]);
  const index = useRef(0);
  // Numéro de lecture : une lecture arrêtée ne relance pas la suivante.
  const run = useRef(0);
  const settings = useRef({ rate, locale });

  useEffect(() => {
    settings.current = { rate, locale };
  }, [rate, locale]);

  // On arrête la voix en quittant la page.
  useEffect(
    () => () => {
      run.current++;
      if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    },
    [],
  );

  function speakFrom(i: number) {
    const synth = window.speechSynthesis;
    const token = ++run.current;
    synth.cancel();
    const next = (k: number) => {
      if (token !== run.current) return;
      const piece = queue.current[k];
      if (!piece) {
        setStatus("idle");
        setCurrent(null);
        index.current = 0;
        return;
      }
      index.current = k;
      setCurrent(piece);
      const utterance = new SpeechSynthesisUtterance(piece.text);
      const lang = voiceLang(settings.current.locale);
      utterance.lang = lang;
      const voice = synth.getVoices().find((v) => v.lang.replace("_", "-").startsWith(lang.slice(0, 2)));
      if (voice) utterance.voice = voice;
      utterance.rate = settings.current.rate;
      utterance.onend = () => next(k + 1);
      utterance.onerror = (event) => {
        // « interrupted » / « canceled » : arrêt demandé par l'élève.
        if (event.error !== "interrupted" && event.error !== "canceled" && token === run.current) setStatus("failed");
      };
      synth.speak(utterance);
    };
    setStatus("playing");
    next(i);
  }

  function buildQueue(all: string[], from: number) {
    queue.current = all.slice(from - 1).flatMap((text, i) => splitForReading(text).map((chunk) => ({ page: from + i, text: chunk })));
  }

  async function play() {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return setStatus("unsupported");
    let all = pages;
    if (!all) {
      setStatus("preparing");
      try {
        all = await extractPages(kind, url);
      } catch {
        return setStatus("failed");
      }
      setPages(all);
    }
    buildQueue(all, startPage);
    if (queue.current.length === 0) return setStatus("noText");
    speakFrom(0);
  }

  function pause() {
    // pause() n'est pas fiable sur tous les téléphones : on arrête et on reprendra au même morceau.
    run.current++;
    window.speechSynthesis.cancel();
    setStatus("paused");
  }

  function stop() {
    run.current++;
    window.speechSynthesis.cancel();
    index.current = 0;
    setCurrent(null);
    setStatus("idle");
  }

  const pageCount = pages?.length ?? 0;
  const button = "rounded-lg px-3 py-2 text-sm font-semibold";
  const select = "rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900";

  return (
    <section
      aria-label={r.title}
      className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary-soft/60 p-3 text-sm dark:bg-primary-strong/15"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span aria-hidden="true">🎧</span>
        <strong className="mr-auto">{r.title}</strong>
        {status === "playing" ? (
          <button type="button" onClick={pause} className={`${button} bg-primary text-white`}>
            ⏸ {r.pause}
          </button>
        ) : status === "paused" ? (
          <button type="button" onClick={() => speakFrom(index.current)} className={`${button} bg-primary text-white`}>
            ▶ {r.resume}
          </button>
        ) : (
          <button type="button" onClick={() => void play()} disabled={status === "preparing"} className={`${button} bg-primary text-white disabled:opacity-60`}>
            ▶ {status === "preparing" ? r.preparing : r.play}
          </button>
        )}
        {status === "playing" || status === "paused" ? (
          <button type="button" onClick={stop} className={`${button} border border-neutral-300 dark:border-neutral-700`}>
            ⏹ {r.stop}
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs">
        <label className="flex items-center gap-1.5">
          {r.speed}
          <select value={rate} onChange={(e) => setRate(Number(e.target.value))} className={select}>
            {READ_SPEEDS.map((s) => (
              <option key={s} value={s}>
                ×{s}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5">
          {r.voice}
          <select value={locale} onChange={(e) => setLocale(e.target.value === "en" ? "en" : "fr")} className={select}>
            <option value="fr">Français</option>
            <option value="en">English</option>
          </select>
        </label>
        {kind === "pdf" && pageCount > 1 && status !== "playing" ? (
          <label className="flex items-center gap-1.5">
            {r.fromPage}
            <select
              value={startPage}
              onChange={(e) => {
                setStartPage(Number(e.target.value));
                index.current = 0;
                if (status === "paused") setStatus("idle");
              }}
              className={select}
            >
              {Array.from({ length: pageCount }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      <p aria-live="polite" className="text-xs text-neutral-700 dark:text-neutral-300">
        {status === "playing" || status === "paused"
          ? kind === "pdf" && current
            ? fill(r.readingPage, { page: current.page, total: pageCount })
            : r.reading
          : status === "noText"
            ? r.noText
            : status === "unsupported"
              ? r.unsupported
              : status === "failed"
                ? r.failed
                : r.hint}
      </p>
      {current && (status === "playing" || status === "paused") ? (
        <p className="rounded-lg bg-white/70 p-2 text-xs italic text-neutral-700 dark:bg-black/20 dark:text-neutral-200">« {current.text} »</p>
      ) : null}
    </section>
  );
}
