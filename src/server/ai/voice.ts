import { GoogleGenAI, Modality } from "@google/genai";

import { CALL_SPEECH_CODES, type CallLanguage } from "@/config/calls";

/**
 * Appels voix avec le Prof ATUM : Gemini Live (Google). La clé reste sur le
 * serveur ; le navigateur reçoit un jeton éphémère, utilisable une seule fois,
 * qui verrouille le modèle et les consignes, et qui expire à la fin des
 * minutes autorisées (le serveur de Google refuse alors la suite de l'appel).
 */

export interface VoiceTokenInput {
  apiKey: string;
  model: string;
  systemInstruction: string;
  language: CallLanguage;
  /** Durée maximale de l'appel, en secondes. */
  maxSeconds: number;
  now?: Date;
}

/** Réglages de la session, verrouillés dans le jeton : le navigateur ne peut pas les changer. */
export function voiceSessionConfig(systemInstruction: string, language: CallLanguage) {
  return {
    responseModalities: [Modality.AUDIO],
    systemInstruction,
    speechConfig: { languageCode: CALL_SPEECH_CODES[language] },
    inputAudioTranscription: {},
    outputAudioTranscription: {},
    sessionResumption: {},
    contextWindowCompression: { slidingWindow: {} },
  };
}

/** Jeton éphémère pour une session Live ; null si Google le refuse. */
export async function createVoiceToken(input: VoiceTokenInput): Promise<string | null> {
  const now = input.now ?? new Date();
  const ai = new GoogleGenAI({ apiKey: input.apiKey, httpOptions: { apiVersion: "v1alpha" } });
  try {
    const token = await ai.authTokens.create({
      config: {
        uses: 1,
        // Quelques secondes de marge pour la connexion ; la fin d'appel est aussi gérée par le navigateur.
        expireTime: new Date(now.getTime() + (input.maxSeconds + 10) * 1000).toISOString(),
        newSessionExpireTime: new Date(now.getTime() + 60 * 1000).toISOString(),
        liveConnectConstraints: {
          model: input.model,
          config: voiceSessionConfig(input.systemInstruction, input.language),
        },
        lockAdditionalFields: [],
      },
    });
    return token.name ?? null;
  } catch {
    return null;
  }
}
