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
    importCta: "Importer un cours",
    recentModules: "Mes modules",
    seeAll: "Tout voir",
  },
  nav: {
    label: "Navigation principale",
    home: "Accueil",
    courses: "Mes cours",
    import: "Importer",
  },
  access: {
    trialNotStarted: "Ton essai gratuit de 24 h démarrera à ton premier import.",
    trialEndsIn: "Essai gratuit : il te reste",
    hours: "h",
    minutes: "min",
    subscribed: "Abonnement actif jusqu'au",
    expired: "Ton accès est terminé. Les forfaits arrivent bientôt dans l'application.",
  },
  courses: {
    title: "Mes cours",
    empty: "Aucun module pour l'instant. Importe un cours pour commencer.",
    chapters: { one: "chapitre", other: "chapitres" },
    documents: { one: "document", other: "documents" },
    newModule: "Nouveau module",
    newModuleName: "Nom du module",
    newModulePlaceholder: "Par exemple : Analyse 2",
    create: "Créer",
    back: "Mes cours",
    moduleChapters: "Chapitres",
    noChapter: "Aucun chapitre. Ajoute-en un, ou importe un cours sans chapitre.",
    newChapterTitle: "Nouveau chapitre",
    newChapterPlaceholder: "Par exemple : Intégrales",
    withoutChapter: "Sans chapitre",
    moduleDocuments: "Documents",
    noDocument: "Aucun document dans ce module.",
    importHere: "Importer dans ce module",
    notFound: "Ce module n'existe pas ou a été supprimé.",
    kinds: { cours: "Cours", examen: "Ancien examen", devoir: "Devoir", exercice: "Exercices" },
    status: {
      uploaded: "En attente de lecture",
      processing: "Lecture en cours…",
      ready: "Prêt",
      failed: "Illisible",
    },
    pages: "pages",
    errors: {
      nameRequired: "Donne un nom (120 caractères au plus).",
      titleRequired: "Donne un titre (200 caractères au plus).",
      unknown: "Une erreur est survenue. Réessaie dans un instant.",
    },
  },
  import: {
    title: "Importer un cours",
    module: "Module",
    chapter: "Chapitre",
    newModuleOption: "+ Nouveau module",
    newChapterOption: "+ Nouveau chapitre",
    noChapterOption: "Sans chapitre",
    kind: "Type de document",
    file: "Fichier",
    chooseFile: "Choisir un PDF ou un Word",
    formats: "Formats acceptés : PDF et Word (.docx), 20 Mo maximum.",
    trialNotice: "Ton essai gratuit de 24 h démarre à ce premier import.",
    submit: "Importer",
    uploading: "Envoi du fichier…",
    registering: "Enregistrement…",
    done: "Document importé. LULU le lit, cela prend en général moins d'une minute.",
    errors: {
      fileRequired: "Choisis un fichier.",
      fileType: "Ce format n'est pas accepté : choisis un PDF ou un fichier Word (.docx).",
      fileTooLarge: "Ce fichier dépasse 20 Mo.",
      moduleRequired: "Choisis un module ou crée-en un.",
      chapterTitleRequired: "Donne un titre au nouveau chapitre.",
      uploadFailed: "L'envoi du fichier a échoué. Vérifie ta connexion et réessaie.",
      accessExpired: "Ton essai est terminé ou ce numéro a déjà eu un essai : il faut un forfait pour importer.",
      unknown: "Une erreur est survenue. Réessaie dans un instant.",
    },
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
    modes: {
      expliquer: "Expliquer",
      approfondir: "Approfondir le chapitre",
      exercer: "S'exercer",
      decouvrir: "Découvrir un sujet",
    },
    call: {
      start: "Appeler Prof LULU",
      title: "Appel avec Prof LULU",
      remaining: "min restantes",
      mute: "Couper le micro",
      camera: "Caméra",
      subtitles: "Sous-titres",
      hangUp: "Raccrocher",
      lowConnection: "Connexion faible : l'appel continue en audio seul.",
      fallbackText: "Connexion trop faible : on continue par écrit.",
      quotaReached: "Tu as utilisé toutes tes minutes d'appel de ce forfait.",
      privacy: "Rien n'est enregistré en audio ni en vidéo : seule la transcription est gardée dans ta conversation.",
    },
    discoverPlaceholder: "Sur quel sujet veux-tu une explication simple ?",
    discoverNotice: "Explication générale : elle ne vient pas de tes cours.",
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
export type CoursesErrorKey = keyof typeof fr.courses.errors;
export type ImportErrorKey = keyof typeof fr.import.errors;

const dictionaries: Record<Locale, Messages> = { fr };

export function getMessages(locale: Locale = "fr"): Messages {
  return dictionaries[locale] ?? dictionaries.fr;
}
