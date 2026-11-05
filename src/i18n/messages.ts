import type { Locale } from "@/config/countries";

/**
 * Tous les textes visibles de l'interface passent par ce dictionnaire.
 * Ajouter une langue = ajouter un objet du même type `Messages`.
 */
const fr = {
  app: {
    name: "LULU",
    tagline: "Ton compagnon d'apprentissage, de l'école à l'université.",
  },
  home: {
    title: "Révise avec tes propres cours",
    intro:
      "Importe un cours en photo ou en PDF. LULU en fait une synthèse, t'explique ce que tu ne comprends pas et te fait réviser avec des quiz.",
    steps: [
      { title: "Importer", body: "Photo ou PDF de ton cours, rangé par module et chapitre." },
      { title: "Comprendre", body: "Une synthèse et un professeur IA qui cite tes pages." },
      { title: "S'entraîner", body: "Des quiz par module ou par chapitre." },
      { title: "Progresser", body: "Tes chapitres maîtrisés et ceux à revoir." },
    ],
    trial: "Essai gratuit de 24 heures, qui démarre à ton premier import.",
  },
  tutor: {
    contestationReply:
      "Je comprends que cette correction te surprenne. Je te propose de refaire un test sur d'autres questions de ce chapitre, ou d'en parler avec un professeur. Ta remarque a bien été enregistrée.",
    attemptRequired:
      "Essaie d'abord de résoudre l'exercice et écris ta démarche, même incomplète. Je t'aiderai ensuite à la corriger.",
    notInDocuments:
      "Je ne trouve pas cette information dans tes documents. Vérifie que le bon cours est importé.",
    unavailable: "Le professeur IA est momentanément indisponible. Réessaie dans quelques minutes.",
  },
} as const;

type DeepString<T> = T extends string
  ? string
  : T extends readonly (infer U)[]
    ? readonly DeepString<U>[]
    : { readonly [K in keyof T]: DeepString<T[K]> };

export type Messages = DeepString<typeof fr>;

const dictionaries: Record<Locale, Messages> = { fr };

export function getMessages(locale: Locale = "fr"): Messages {
  return dictionaries[locale] ?? dictionaries.fr;
}
