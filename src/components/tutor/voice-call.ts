import { CALL_INPUT_RATE, CALL_OUTPUT_RATE } from "@/config/calls";
import { appendTranscript, downsample, floatToPcm16Base64, pcm16Base64ToFloat, type TranscriptLine } from "@/lib/call";

/**
 * Appel en direct avec le Prof NEO, dans le navigateur : micro (et caméra en
 * option) envoyés à Gemini Live avec le jeton éphémère donné par le serveur,
 * voix du professeur jouée au fil de l'eau, transcription des deux côtés.
 * Rien n'est enregistré : l'audio et les images ne font que passer.
 */

export type CallPhase = "connecting" | "live" | "ended";
export type CallEndReason = "raccroche" | "quota" | "connexion" | "erreur";

export interface VoiceCallState {
  phase: CallPhase;
  speaking: boolean;
  muted: boolean;
  camera: boolean;
  transcript: TranscriptLine[];
}

export interface VoiceCallOptions {
  token: string;
  model: string;
  stream: MediaStream;
  onState: (state: VoiceCallState) => void;
  /** Fin de l'appel côté réseau (Google a coupé, jeton expiré…). */
  onDrop: (reason: CallEndReason) => void;
}

/** Récupère les blocs de 20 ms du micro et les renvoie au fil de l'eau. */
const CAPTURE_WORKLET = `
class AtumiCapture extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (channel) this.port.postMessage(channel.slice(0));
    return true;
  }
}
registerProcessor("atumi-capture", AtumiCapture);
`;

const SEND_EVERY_SAMPLES = CALL_INPUT_RATE / 10; // 100 ms
/** Une image toutes les 2 s suffit pour lire un cahier et limite le coût. */
const VIDEO_FRAME_MS = 2000;
const VIDEO_WIDTH = 640;
const MAX_RECONNECTS = 3;

interface LiveSession {
  sendRealtimeInput(params: Record<string, unknown>): void;
  close(): void;
}

interface LiveMessage {
  serverContent?: {
    modelTurn?: { parts?: { inlineData?: { data?: string; mimeType?: string } }[] };
    inputTranscription?: { text?: string };
    outputTranscription?: { text?: string };
    interrupted?: boolean;
    turnComplete?: boolean;
  };
  usageMetadata?: { promptTokenCount?: number; responseTokenCount?: number; totalTokenCount?: number };
  sessionResumptionUpdate?: { newHandle?: string; resumable?: boolean };
  goAway?: unknown;
}

export class VoiceCall {
  private state: VoiceCallState;
  private session: LiveSession | null = null;
  private captureContext: AudioContext | null = null;
  private playbackContext: AudioContext | null = null;
  private playing = new Set<AudioBufferSourceNode>();
  private nextPlayTime = 0;
  private pending: Float32Array[] = [];
  private pendingLength = 0;
  private videoTimer: ReturnType<typeof setInterval> | null = null;
  private resumeHandle: string | null = null;
  private reconnects = 0;
  private closing = false;
  private inputTokens = 0;
  private outputTokens = 0;

  constructor(private readonly options: VoiceCallOptions) {
    this.state = {
      phase: "connecting",
      speaking: false,
      muted: false,
      camera: options.stream.getVideoTracks().length > 0,
      transcript: [],
    };
  }

  get usage() {
    return { inputTokens: this.inputTokens, outputTokens: this.outputTokens };
  }

  get transcript() {
    return this.state.transcript;
  }

  private update(patch: Partial<VoiceCallState>) {
    this.state = { ...this.state, ...patch };
    this.options.onState(this.state);
  }

  async start() {
    this.playbackContext = new AudioContext({ sampleRate: CALL_OUTPUT_RATE });
    await this.connect();
    await this.startMicrophone();
    if (this.state.camera) this.startCamera();
    this.update({ phase: "live" });
  }

  private async connect() {
    const { GoogleGenAI, Modality } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey: this.options.token, httpOptions: { apiVersion: "v1alpha" } });
    // Les réglages réels (consignes, langue, transcription) sont verrouillés dans le jeton par le serveur.
    this.session = (await ai.live.connect({
      model: this.options.model,
      config: {
        responseModalities: [Modality.AUDIO],
        sessionResumption: this.resumeHandle ? { handle: this.resumeHandle } : {},
      },
      callbacks: {
        onmessage: (message) => this.onMessage(message as LiveMessage),
        onclose: () => void this.onClose(),
        onerror: () => undefined,
      },
    })) as unknown as LiveSession;
  }

  private async onClose() {
    this.session = null;
    if (this.closing) return;
    // Google ferme régulièrement les connexions longues : on reprend la même session.
    if (this.resumeHandle && this.reconnects < MAX_RECONNECTS) {
      this.reconnects++;
      try {
        await this.connect();
        return;
      } catch {
        // la reprise a échoué : fin de l'appel ci-dessous
      }
    }
    this.options.onDrop("connexion");
  }

  private onMessage(message: LiveMessage) {
    const content = message.serverContent;
    if (message.sessionResumptionUpdate?.resumable && message.sessionResumptionUpdate.newHandle) {
      this.resumeHandle = message.sessionResumptionUpdate.newHandle;
    }
    if (message.usageMetadata) {
      this.inputTokens += message.usageMetadata.promptTokenCount ?? 0;
      this.outputTokens += message.usageMetadata.responseTokenCount ?? 0;
    }
    if (!content) return;
    if (content.interrupted) this.stopPlayback();
    for (const part of content.modelTurn?.parts ?? []) {
      if (part.inlineData?.data && part.inlineData.mimeType?.startsWith("audio/")) this.play(part.inlineData.data);
    }
    let transcript = this.state.transcript;
    if (content.inputTranscription?.text) transcript = appendTranscript(transcript, "user", content.inputTranscription.text);
    if (content.outputTranscription?.text) transcript = appendTranscript(transcript, "assistant", content.outputTranscription.text);
    if (transcript !== this.state.transcript) this.update({ transcript });
  }

  private play(data: string) {
    const ctx = this.playbackContext;
    if (!ctx) return;
    const samples = pcm16Base64ToFloat(data);
    if (samples.length === 0) return;
    const buffer = ctx.createBuffer(1, samples.length, CALL_OUTPUT_RATE);
    buffer.copyToChannel(samples as Float32Array<ArrayBuffer>, 0);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    const startAt = Math.max(this.nextPlayTime, ctx.currentTime + 0.02);
    source.start(startAt);
    this.nextPlayTime = startAt + buffer.duration;
    this.playing.add(source);
    if (!this.state.speaking) this.update({ speaking: true });
    source.onended = () => {
      this.playing.delete(source);
      if (this.playing.size === 0) this.update({ speaking: false });
    };
  }

  /** L'élève a coupé la parole au professeur : on arrête sa voix tout de suite. */
  private stopPlayback() {
    for (const source of this.playing) {
      try {
        source.stop();
      } catch {
        // déjà arrêtée
      }
    }
    this.playing.clear();
    this.nextPlayTime = 0;
    this.update({ speaking: false });
  }

  private async startMicrophone() {
    const ctx = new AudioContext();
    this.captureContext = ctx;
    const url = URL.createObjectURL(new Blob([CAPTURE_WORKLET], { type: "application/javascript" }));
    try {
      await ctx.audioWorklet.addModule(url);
    } finally {
      URL.revokeObjectURL(url);
    }
    const source = ctx.createMediaStreamSource(this.options.stream);
    const node = new AudioWorkletNode(ctx, "atumi-capture");
    const silent = ctx.createGain();
    silent.gain.value = 0;
    source.connect(node).connect(silent).connect(ctx.destination);
    node.port.onmessage = (event: MessageEvent<Float32Array>) => {
      if (this.state.muted || !this.session) return;
      const chunk = downsample(event.data, ctx.sampleRate, CALL_INPUT_RATE);
      this.pending.push(chunk);
      this.pendingLength += chunk.length;
      if (this.pendingLength < SEND_EVERY_SAMPLES) return;
      const merged = new Float32Array(this.pendingLength);
      let offset = 0;
      for (const part of this.pending) {
        merged.set(part, offset);
        offset += part.length;
      }
      this.pending = [];
      this.pendingLength = 0;
      this.session.sendRealtimeInput({ audio: { data: floatToPcm16Base64(merged), mimeType: `audio/pcm;rate=${CALL_INPUT_RATE}` } });
    };
  }

  /** Une image de la caméra toutes les 2 s (cahier, exercice), réduite avant l'envoi. */
  private startCamera() {
    const track = this.options.stream.getVideoTracks()[0];
    if (!track) return;
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.srcObject = new MediaStream([track]);
    void video.play().catch(() => undefined);
    const canvas = document.createElement("canvas");
    this.videoTimer = setInterval(() => {
      if (!this.session || !this.state.camera || video.videoWidth === 0) return;
      const scale = Math.min(1, VIDEO_WIDTH / video.videoWidth);
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
      const data = canvas.toDataURL("image/jpeg", 0.6).split(",")[1];
      if (data) this.session.sendRealtimeInput({ video: { data, mimeType: "image/jpeg" } });
    }, VIDEO_FRAME_MS);
  }

  setMuted(muted: boolean) {
    for (const track of this.options.stream.getAudioTracks()) track.enabled = !muted;
    if (muted) this.session?.sendRealtimeInput({ audioStreamEnd: true });
    this.update({ muted });
  }

  setCamera(on: boolean) {
    const track = this.options.stream.getVideoTracks()[0];
    if (!track) return;
    track.enabled = on;
    this.update({ camera: on });
  }

  /** Coupe tout : connexion, micro, caméra, sons. */
  stop() {
    this.closing = true;
    if (this.videoTimer) clearInterval(this.videoTimer);
    this.stopPlayback();
    try {
      this.session?.close();
    } catch {
      // déjà fermée
    }
    this.session = null;
    for (const track of this.options.stream.getTracks()) track.stop();
    void this.captureContext?.close().catch(() => undefined);
    void this.playbackContext?.close().catch(() => undefined);
    this.update({ phase: "ended", speaking: false });
  }
}
