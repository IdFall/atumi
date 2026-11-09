import { z } from "zod";

/**
 * Travaux lourds traités en arrière-plan par les workers.
 * L'API dépose un travail et rend la main tout de suite ; l'apprenant est
 * prévenu quand le résultat est prêt.
 */
export const QUEUES = {
  /** Lecture du fichier (texte ou vision), découpage par chapitres, indexation. */
  documentIngest: "document-ingest",
  /** Synthèse d'un module ou d'un chapitre, générée une fois puis réutilisée. */
  synthesisGenerate: "synthesis-generate",
  /** Banque de questions d'un module ou d'un chapitre. */
  quizGenerate: "quiz-generate",
  /** Message écrit à l'équipe depuis le centre d'aide : envoi par e-mail et WhatsApp. */
  supportNotify: "support-notify",
  /** Avis au parent d'un lycéen mineur, avec un lien pour refuser l'inscription. */
  parentNotify: "parent-notify",
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

const uuid = z.uuid();

export const payloadSchemas = {
  [QUEUES.documentIngest]: z.object({ userId: uuid, documentId: uuid }),
  /** La synthèse et le quiz sont créés « en préparation » par le serveur, le worker les complète. */
  [QUEUES.synthesisGenerate]: z.object({ userId: uuid, synthesisId: uuid }),
  [QUEUES.quizGenerate]: z.object({ userId: uuid, quizId: uuid }),
  [QUEUES.supportNotify]: z.object({ requestId: z.number().int().positive() }),
  [QUEUES.parentNotify]: z.object({ userId: uuid }),
} satisfies Record<QueueName, z.ZodType>;

export type Payload<Q extends QueueName> = z.infer<(typeof payloadSchemas)[Q]>;

/** Réglages communs : nouvelles tentatives espacées, durée maximale par travail. */
export const QUEUE_OPTIONS = {
  retryLimit: 3,
  retryDelay: 30,
  retryBackoff: true,
  expireInSeconds: 15 * 60,
} as const;
