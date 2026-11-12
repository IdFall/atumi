import { z } from "zod";

/**
 * Règles de validation partagées des formulaires (le serveur décide toujours ;
 * les contrôles du navigateur ne sont qu'un confort). Testées par
 * `tests/form-validation.test.ts`.
 */

/** Caractères de contrôle invisibles (octet nul compris), sauf retour à la ligne et tabulation. */
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u2028\u2029\u202A-\u202E\u2066-\u2069\uFEFF]/g;

/** Retire les caractères de contrôle et les marques de direction du texte saisi. */
export function stripControlChars(value: string): string {
  return value.replace(CONTROL_CHARS, "");
}

/** Texte saisi : chaîne, nettoyée, sans espaces autour, entre `min` et `max` caractères. */
export function safeText(min: number, max: number) {
  return z.string().transform(stripControlChars).pipe(z.string().trim().min(min).max(max));
}

/** Question au Prof NEO (`sendTutorMessageAction`). */
export const TUTOR_MODES = ["expliquer", "approfondir", "exercer", "decouvrir"] as const;
export const tutorInputSchema = z.object({
  conversationId: z.union([z.uuid(), z.literal("")]),
  mode: z.enum(TUTOR_MODES),
  moduleId: z.union([z.uuid(), z.literal("")]),
  chapterId: z.union([z.uuid(), z.literal("")]),
  text: safeText(1, 4000),
});

/** Recherche web IA. */
export const researchQuestionSchema = safeText(3, 500);

/** Centre d'aide : question à l'assistant et message à l'équipe. */
export const helpQuestionSchema = safeText(1, 1000);
export const helpMessageSchema = safeText(1, 2000);

/** Déclaration d'un paiement Wave / Orange Money. */
export const paymentRequestSchema = z.object({
  planCode: z.string().regex(/^[a-z]{2}-[a-z0-9-]{2,40}$/),
  provider: z.string().regex(/^[a-z_]{2,30}$/),
  reference: safeText(3, 80),
});

/** Texte partagé « Lire la suite » : titre et contenu. */
export const sharedTextSchema = z.object({
  title: safeText(1, 200),
  content: z.string().trim().min(1).max(60_000),
});

/** Recherche dans le dictionnaire ou l'encyclopédie. */
export const referenceLookupSchema = z.object({
  kind: z.enum(["dictionary", "encyclopedia"]),
  term: safeText(1, 100),
});

/** Contestation d'une correction (raison facultative). */
export const contestReasonSchema = z.string().transform(stripControlChars).pipe(z.string().trim().max(1000));
