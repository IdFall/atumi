/**
 * Appels voix (vidéo en option) avec le Prof ATUM. Les minutes viennent du
 * forfait (`plans.call_minutes_limit`, `call_quota()`) ; ces réglages bornent
 * chaque appel.
 */

/** Durée maximale d'un appel, même avec des minutes illimitées. */
export const MAX_CALL_SECONDS = 30 * 60;

/** En dessous, on ne lance pas d'appel : il serait coupé aussitôt. */
export const MIN_CALL_SECONDS = 15;

/** Le navigateur signale l'appel en cours à ce rythme ; la durée facturée suit ces signaux. */
export const CALL_HEARTBEAT_SECONDS = 20;

/** Longueur maximale de la transcription gardée dans la conversation. */
export const CALL_TRANSCRIPT_MAX_CHARS = 20_000;

/** Audio envoyé au modèle : PCM 16 bits mono à 16 kHz ; audio reçu : 24 kHz. */
export const CALL_INPUT_RATE = 16_000;
export const CALL_OUTPUT_RATE = 24_000;

/**
 * Mémoire de l'appel : au-delà de CALL_CONTEXT_TRIGGER_TOKENS (≈ 5 min d'échange
 * avec les consignes), le modèle ne garde que les CALL_CONTEXT_TARGET_TOKENS
 * derniers jetons. Google refacture l'historique à chaque réponse : cette
 * limite garde le coût d'un appel long proche de celui d'un appel court.
 */
export const CALL_CONTEXT_TRIGGER_TOKENS = 16_000;
export const CALL_CONTEXT_TARGET_TOKENS = 8_000;

/** Langues parlées pendant un appel (le wolof n'est pas encore assez fiable à l'oral). */
export const CALL_LANGUAGES = ["fr", "en"] as const;
export type CallLanguage = (typeof CALL_LANGUAGES)[number];

export const CALL_SPEECH_CODES: Record<CallLanguage, string> = { fr: "fr-FR", en: "en-US" };
