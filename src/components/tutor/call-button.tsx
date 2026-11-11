"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { CALL_HEARTBEAT_SECONDS, MIN_CALL_SECONDS } from "@/config/calls";
import { useT } from "@/i18n/client";
import type { TutorMode } from "@/server/ai/prompts";
import { endCallAction, heartbeatCallAction, startCallAction, type StartCallError } from "@/server/calls/actions";

import { VoiceCall, type CallEndReason, type VoiceCallState } from "./voice-call";

interface Props {
  conversationId: string | null;
  mode: TutorMode;
  moduleId: string | null;
  chapterId: string | null;
  /** Service de voix configuré sur le serveur. */
  available: boolean;
  hasAccess: boolean;
  /** Secondes restantes sur le forfait ; null = sans limite. */
  secondsLeft: number | null;
}

type ErrorKey = StartCallError | "microphone" | "connection";

function clock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Bouton « Appeler le Prof » et écran d'appel (voix, caméra en option). */
export function CallButton({ conversationId, mode, moduleId, chapterId, available, hasAccess, secondsLeft }: Props) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [withVideo, setWithVideo] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<ErrorKey | null>(null);
  const [state, setState] = useState<VoiceCallState | null>(null);
  const [remaining, setRemaining] = useState(0);
  const callRef = useRef<{ voice: VoiceCall; callId: string; conversationId: string } | null>(null);
  const endingRef = useRef(false);
  const deadlineRef = useRef(0);

  const noMinutes = secondsLeft !== null && secondsLeft < MIN_CALL_SECONDS;
  const live = state !== null && state.phase !== "ended";

  async function finish(reason: CallEndReason) {
    const current = callRef.current;
    if (!current || endingRef.current) return;
    endingRef.current = true;
    current.voice.stop();
    await endCallAction({
      callId: current.callId,
      reason,
      transcript: current.voice.transcript,
      usage: current.voice.usage,
    }).catch(() => undefined);
    callRef.current = null;
    setState(null);
    setOpen(false);
    if (reason === "connexion") setError("connection");
    if (conversationId === current.conversationId) router.refresh();
    else router.push(`/professeur/${current.conversationId}`);
  }

  // Décompte des minutes, signal régulier au serveur, fin automatique.
  useEffect(() => {
    if (!live) return;
    const timer = setInterval(() => {
      const left = Math.round((deadlineRef.current - Date.now()) / 1000);
      setRemaining(Math.max(0, left));
      if (left <= 0) void finish("quota");
    }, 1000);
    const beat = setInterval(() => {
      const current = callRef.current;
      if (current) void heartbeatCallAction(current.callId).catch(() => undefined);
    }, CALL_HEARTBEAT_SECONDS * 1000);
    return () => {
      clearInterval(timer);
      clearInterval(beat);
    };
    // finish est recréée à chaque rendu ; l'appel en cours est lu dans callRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live]);

  // Onglet fermé ou page quittée pendant l'appel : on coupe micro et connexion.
  useEffect(() => {
    if (!live) return;
    const onHide = () => void finish("raccroche");
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live]);

  async function start() {
    setError(null);
    setStarting(true);
    endingRef.current = false;
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
        video: withVideo ? { facingMode: "environment", width: { ideal: 1280 } } : false,
      });
    } catch {
      setStarting(false);
      setError("microphone");
      return;
    }
    const result = await startCallAction({ conversationId, mode, moduleId, chapterId, withVideo }).catch(() => null);
    if (!result || !result.ok) {
      for (const track of stream.getTracks()) track.stop();
      setStarting(false);
      setError(result ? result.error : "unknown");
      return;
    }
    const voice = new VoiceCall({
      token: result.token,
      model: result.model,
      stream,
      onState: setState,
      onDrop: (reason) => void finish(reason),
    });
    callRef.current = { voice, callId: result.callId, conversationId: result.conversationId };
    setRemaining(result.maxSeconds);
    deadlineRef.current = Date.now() + result.maxSeconds * 1000;
    try {
      await voice.start();
    } catch {
      await finish("erreur");
      setError("connection");
    } finally {
      setStarting(false);
    }
  }

  if (!available) return null;

  if (!hasAccess || noMinutes) {
    return (
      <p className="flex flex-wrap items-center gap-2 rounded-xl border border-neutral-200 px-4 py-3 text-sm dark:border-neutral-800">
        <PhoneIcon />
        <span className="text-neutral-600 dark:text-neutral-300">{hasAccess ? t.call.noMinutes : t.call.noAccess}</span>
        <Link href={hasAccess ? "/abonnement#recharges" : "/abonnement"} className="font-semibold text-primary dark:text-lavande">
          {hasAccess ? t.call.buyMinutes : t.call.seePlans}
        </Link>
      </p>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        className="flex items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm font-semibold text-primary-strong hover:bg-primary/10 dark:border-lavande/30 dark:text-lavande"
      >
        <PhoneIcon />
        {t.call.button}
        {secondsLeft !== null ? (
          <span className="font-normal text-neutral-600 dark:text-neutral-300">
            · {t.call.minutesLeft.replace("{minutes}", String(Math.floor(secondsLeft / 60)))}
          </span>
        ) : null}
      </button>
      {error && !open ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {t.call.errors[error]}
        </p>
      ) : null}

      {open ? (
        <div role="dialog" aria-modal="true" aria-label={t.call.title} className="fixed inset-0 z-50 flex flex-col bg-nuit text-white">
          <header className="flex items-center justify-between px-4 py-3">
            <p className="text-sm font-semibold">{t.call.title}</p>
            {live ? <p className="font-mono text-sm tabular-nums text-lavande">{clock(remaining)}</p> : null}
          </header>

          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4">
            <div className={`rounded-full p-2 ${state?.speaking ? "atumi-call-pulse bg-accent/30" : "bg-white/10"}`}>
              <Image src="/prof-atumi.svg" alt={t.tutor.avatarAlt} width={112} height={112} priority />
            </div>
            <p className="text-lg font-semibold">{t.tutor.name}</p>
            <p role="status" className="text-sm text-lavande">
              {starting || state?.phase === "connecting"
                ? t.call.connecting
                : live
                  ? state.speaking
                    ? t.call.speaking
                    : state.muted
                      ? t.call.mutedStatus
                      : t.call.listening
                  : t.call.ready}
            </p>
            {live && state.transcript.length > 0 ? (
              <ol className="max-h-48 w-full max-w-md overflow-y-auto rounded-xl bg-white/5 p-3 text-sm" aria-live="polite">
                {state.transcript.slice(-6).map((line, i) => (
                  <li key={i} className={line.role === "user" ? "text-right text-lavande" : "text-white"}>
                    {line.text}
                  </li>
                ))}
              </ol>
            ) : null}
            {!live ? (
              <div className="flex w-full max-w-md flex-col gap-3 text-sm">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={withVideo} onChange={(e) => setWithVideo(e.target.checked)} className="size-4" />
                  {t.call.withVideo}
                </label>
                <p className="text-xs text-white/70">{t.call.privacy}</p>
                {error ? (
                  <p role="alert" className="font-semibold text-red-300">
                    {t.call.errors[error]}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          <footer className="flex items-center justify-center gap-3 px-4 pb-8 pt-4">
            {live ? (
              <>
                <button
                  type="button"
                  onClick={() => callRef.current?.voice.setMuted(!state.muted)}
                  aria-pressed={state.muted}
                  className="rounded-full bg-white/10 px-4 py-3 text-sm font-semibold hover:bg-white/20"
                >
                  {state.muted ? t.call.unmute : t.call.mute}
                </button>
                {withVideo ? (
                  <button
                    type="button"
                    onClick={() => callRef.current?.voice.setCamera(!state.camera)}
                    aria-pressed={!state.camera}
                    className="rounded-full bg-white/10 px-4 py-3 text-sm font-semibold hover:bg-white/20"
                  >
                    {state.camera ? t.call.cameraOff : t.call.cameraOn}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => void finish("raccroche")}
                  className="rounded-full bg-red-600 px-5 py-3 text-sm font-semibold hover:bg-red-700"
                >
                  {t.call.hangUp}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={starting}
                  className="rounded-full bg-white/10 px-5 py-3 text-sm font-semibold hover:bg-white/20 disabled:opacity-50"
                >
                  {t.call.cancel}
                </button>
                <button
                  type="button"
                  onClick={() => void start()}
                  disabled={starting}
                  className="rounded-full bg-emerald-600 px-5 py-3 text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50"
                >
                  {t.call.start}
                </button>
              </>
            )}
          </footer>
        </div>
      ) : null}
    </>
  );
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />
    </svg>
  );
}
