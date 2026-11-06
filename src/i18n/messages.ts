import type { Locale } from "@/config/countries";

/**
 * Tous les textes visibles de l'interface passent par ce dictionnaire.
 * Ajouter une langue = ajouter un objet du même type `Messages`.
 */
const fr = {
  app: {
    name: "LULU",
    tagline: "Ton compagnon d'apprentissage, du lycée à l'université.",
  },
  home: {
    title: "Révise avec tes propres cours",
    intro:
      "Importe un cours en PDF ou en Word. LULU en fait une synthèse, t'explique ce que tu ne comprends pas et te fait réviser avec des quiz.",
    steps: [
      { title: "Importer", body: "PDF ou Word de ton cours, rangé par module et chapitre." },
      { title: "Comprendre", body: "Une synthèse et un professeur IA qui cite tes pages." },
      { title: "S'entraîner", body: "Des quiz par module ou par chapitre." },
      { title: "Progresser", body: "Tes chapitres maîtrisés et ceux à revoir." },
    ],
    trial: "Essai gratuit de 24 heures, qui démarre à ton premier import.",
    signUp: "Créer mon compte",
    signIn: "J'ai déjà un compte",
  },
  auth: {
    signUpTitle: "Créer ton compte",
    signInTitle: "Te connecter",
    verifyTitle: "Confirmer ton numéro",
    fields: {
      username: "Nom d'utilisateur",
      usernameHint: "3 à 32 caractères : lettres minuscules, chiffres, point ou tiret bas.",
      identifier: "E-mail ou numéro de téléphone",
      password: "Mot de passe",
      passwordHint: "8 caractères minimum.",
      cycle: "Niveau d'étude en cours",
      guardianPhone: "Téléphone d'un parent ou tuteur",
      guardianPhoneHint: "Les lycéens ont besoin de l'accord d'un parent.",
      acceptCgu: "J'accepte les conditions d'utilisation et la politique de confidentialité.",
      code: "Code reçu par SMS",
    },
    cycles: {
      college: "Collège",
      lycee: "Lycée",
      universite: "Université",
    },
    submitSignUp: "Créer mon compte",
    submitSignIn: "Me connecter",
    submitVerify: "Confirmer",
    signOut: "Me déconnecter",
    toSignIn: "Déjà un compte ? Connecte-toi",
    toSignUp: "Pas encore de compte ? Inscris-toi",
    checkEmail: "Ton compte est créé. Ouvre le lien envoyé par e-mail pour l'activer.",
    errors: {
      usernameInvalid: "Ce nom d'utilisateur n'est pas valide.",
      usernameTaken: "Ce nom d'utilisateur est déjà pris.",
      identifierInvalid: "Saisis une adresse e-mail ou un numéro de téléphone valide.",
      identifierTaken: "Un compte existe déjà avec cet e-mail ou ce numéro.",
      countryNotOpen: "LULU n'est pas encore disponible dans ce pays.",
      passwordLength: "Le mot de passe doit contenir entre 8 et 72 caractères.",
      passwordRequired: "Saisis ton mot de passe.",
      cycleRequired: "Choisis ton niveau d'étude.",
      cycleNotOpen: "LULU est ouvert aux lycéens et aux étudiants pour le moment.",
      guardianPhoneRequired: "Saisis le numéro d'un parent ou tuteur.",
      guardianPhoneSameAsUser: "Le numéro du parent doit être différent du tien.",
      cguRequired: "Tu dois accepter les conditions pour continuer.",
      invalidCredentials: "Identifiant ou mot de passe incorrect.",
      invalidCode: "Code incorrect ou expiré.",
      unknown: "Une erreur est survenue. Réessaie dans un instant.",
    },
  },
  dashboard: {
    greeting: "Bonjour",
    loading: "Chargement…",
    empty: "Commence par importer ton premier cours.",
  },
  tutor: {
    contestationReply:
      "Je comprends que cette correction te surprenne. Je te propose de refaire un test sur d'autres questions de ce chapitre, ou d'en parler avec un professeur. Ta remarque a bien été enregistrée.",
    attemptRequired:
      "Essaie d'abord de résoudre l'exercice et écris ta démarche, même incomplète. Je t'aiderai ensuite à la corriger.",
    notInDocuments:
      "Je ne trouve pas cette information dans tes documents. Vérifie que le bon cours est importé.",
    unavailable: "Le professeur IA est momentanément indisponible. Réessaie dans quelques minutes.",
    name: "Prof LULU",
    avatarAlt: "Professeur LULU",
    subtitle: "Répond à partir de ton cours",
    languageLabel: "Langue du professeur",
    languages: { fr: "Français", en: "English", wo: "Wolof" },
    betaBadge: "bêta",
    modes: { expliquer: "Expliquer", approfondir: "Approfondir le chapitre", exercer: "S'exercer" },
    quickReplies: {
      otherWay: "Explique autrement",
      example: "Un exemple",
      simpler: "Plus simple",
      chapterSummary: "Résumé du chapitre",
    },
  },
} as const;

type DeepString<T> = T extends string
  ? string
  : T extends readonly (infer U)[]
    ? readonly DeepString<U>[]
    : { readonly [K in keyof T]: DeepString<T[K]> };

export type Messages = DeepString<typeof fr>;

export type AuthErrorKey = keyof typeof fr.auth.errors;

const dictionaries: Record<Locale, Messages> = { fr };

export function getMessages(locale: Locale = "fr"): Messages {
  return dictionaries[locale] ?? dictionaries.fr;
}
