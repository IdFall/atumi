/**
 * Fonctions pures des appels avec le Prof NEO : conversion de l'audio
 * (navigateur ↔ modèle), durée facturée et transcription gardée.
 */

/** Ramène un signal à une fréquence plus basse (moyenne par fenêtre). */
export function downsample(input: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (toRate >= fromRate) return input;
  const ratio = fromRate / toRate;
  const length = Math.floor(input.length / ratio);
  const out = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(input.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = start; j < end; j++) sum += input[j];
    out[i] = end > start ? sum / (end - start) : 0;
  }
  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** Échantillons [-1, 1] → PCM 16 bits little-endian, en base64. */
export function floatToPcm16Base64(samples: Float32Array): string {
  const view = new DataView(new ArrayBuffer(samples.length * 2));
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return bytesToBase64(new Uint8Array(view.buffer));
}

/** PCM 16 bits little-endian en base64 → échantillons [-1, 1]. */
export function pcm16Base64ToFloat(data: string): Float32Array {
  const binary = atob(data);
  const count = Math.floor(binary.length / 2);
  const out = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const lo = binary.charCodeAt(i * 2);
    const hi = binary.charCodeAt(i * 2 + 1);
    let value = (hi << 8) | lo;
    if (value >= 0x8000) value -= 0x10000;
    out[i] = value / 0x8000;
  }
  return out;
}

/** Secondes facturées entre le début et le dernier signal de l'appel, bornées. */
export function billedSeconds(startedAt: Date, until: Date, maxSeconds: number): number {
  const seconds = Math.round((until.getTime() - startedAt.getTime()) / 1000);
  return Math.max(0, Math.min(seconds, maxSeconds));
}

export interface TranscriptLine {
  role: "user" | "assistant";
  text: string;
}

/** Ajoute un morceau de transcription : il prolonge la dernière ligne du même interlocuteur. */
export function appendTranscript(lines: readonly TranscriptLine[], role: TranscriptLine["role"], text: string): TranscriptLine[] {
  if (!text) return [...lines];
  const last = lines.at(-1);
  if (last && last.role === role) return [...lines.slice(0, -1), { role, text: last.text + text }];
  return [...lines, { role, text }];
}

/**
 * Texte brut de la transcription, sans syntaxe du tableau (formules, encadrés,
 * schémas, images) : ce que l'élève et le modèle ont dit est une donnée.
 */
function plain(text: string): string {
  return text
    .replace(/[`$]/g, "")
    .replace(/\[image:/gi, "(image :")
    .replace(/^\s*(:::|#+|\||>)/gm, "")
    .replace(/[*_]{2,}/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Transcription gardée dans la conversation (Markdown simple), coupée si elle est trop longue. */
export function formatCallTranscript(
  lines: readonly TranscriptLine[],
  labels: { title: string; user: string; assistant: string },
  maxChars: number,
): string {
  const body: string[] = [];
  let length = 0;
  for (const line of lines) {
    const text = plain(line.text);
    if (!text) continue;
    const entry = `**${line.role === "user" ? labels.user : labels.assistant} :** ${text}`;
    if (length + entry.length > maxChars) {
      body.push("…");
      break;
    }
    body.push(entry);
    length += entry.length;
  }
  if (body.length === 0) return "";
  return `**${labels.title}**\n\n${body.join("\n\n")}`;
}
