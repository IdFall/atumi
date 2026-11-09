/**
 * Lecture d'une photo de cours par le modèle (via AiProvider).
 * Le modèle juge d'abord la photo : floue, coupée, sombre ou hors sujet,
 * l'apprenant doit la reprendre avant toute synthèse ou quiz.
 */
import { JPEG_MIME, MAX_IMAGE_BYTES, PNG_MIME, WEBP_MIME, type ImageMimeType } from "../../config/documents";
import { parsePhotoReading, PHOTO_READING_SYSTEM_PROMPT, PHOTO_READING_USER_TEXT } from "../ai/prompts";
import type { AiProvider, AiUsage } from "../ai/types";

import type { PageText } from "./chunk";

/** Raisons de refus d'une photo, toutes résolues en la reprenant (ou en important un PDF). */
export type PhotoProblem = "blurry" | "cropped" | "dark" | "offTopic" | "noText" | "tooLarge" | "corrupted" | "refused" | "aiDisabled";

export type PhotoReadResult =
  | { status: "ok"; pages: PageText[]; usage: AiUsage }
  | { status: "rejected"; problem: PhotoProblem; usage: AiUsage | null }
  /** Panne passagère du service : le worker relancera la lecture. */
  | { status: "retry"; reason: string };

/** En dessous, la photo ne contient pas assez de texte pour une synthèse ou un quiz. */
const MIN_PHOTO_CHARS = 40;

const PROBLEM_BY_VERDICT = { floue: "blurry", coupee: "cropped", sombre: "dark", hors_sujet: "offTopic" } as const;

/** Type réel de l'image, d'après ses premiers octets (le type déclaré peut être faux). */
export function sniffImageType(bytes: Uint8Array): ImageMimeType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return JPEG_MIME;
  if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => bytes[i] === b)) return PNG_MIME;
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to));
  if (bytes.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return WEBP_MIME;
  return null;
}

export async function readPhoto(provider: AiProvider, bytes: Uint8Array): Promise<PhotoReadResult> {
  if (bytes.length > MAX_IMAGE_BYTES) return { status: "rejected", problem: "tooLarge", usage: null };
  const mediaType = sniffImageType(bytes);
  if (!mediaType) return { status: "rejected", problem: "corrupted", usage: null };

  const result = await provider.complete({
    feature: "image_reading",
    tier: "standard",
    system: PHOTO_READING_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", mediaType, base64: Buffer.from(bytes).toString("base64") },
          { type: "text", text: PHOTO_READING_USER_TEXT },
        ],
      },
    ],
    maxTokens: 8000,
  });

  if (result.status === "unavailable") {
    // Sans clé d'API, inutile de relancer : la photo ne peut pas être lue.
    if (result.reason === "missing_api_key") return { status: "rejected", problem: "aiDisabled", usage: null };
    return { status: "retry", reason: result.reason };
  }
  if (result.status === "refused") return { status: "rejected", problem: "refused", usage: result.usage };

  const reading = parsePhotoReading(result.text);
  if (!reading) return { status: "rejected", problem: "refused", usage: result.usage };
  if (reading.verdict !== "lisible") {
    return { status: "rejected", problem: PROBLEM_BY_VERDICT[reading.verdict], usage: result.usage };
  }
  if (reading.text.length < MIN_PHOTO_CHARS) return { status: "rejected", problem: "noText", usage: result.usage };

  // Une photo = une page, sans numéro de page connu : citations « [doc] ».
  return { status: "ok", pages: [{ page: null, text: reading.text }], usage: result.usage };
}
