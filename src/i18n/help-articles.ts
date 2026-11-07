/**
 * Articles du centre d'aide. L'assistant d'aide ne répond qu'à partir de ces
 * textes : les garder exacts quand le produit change.
 *
 * Ce qui dépend du pays (moyens de paiement) est injecté depuis la
 * configuration du pays, jamais écrit en dur.
 */
import type { PaymentMethod } from "@/config/countries";

export type HelpArticleId =
  | "essai"
  | "paiement"
  | "import"
  | "synthese-quiz"
  | "professeur"
  | "appels"
  | "compte"
  | "confidentialite";

export interface HelpArticle {
  id: HelpArticleId;
  title: string;
  body: string;
}

export interface HelpContext {
  paymentMethods: readonly PaymentMethod[];
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  wave: "Wave",
  orange_money: "Orange Money",
  free_money: "Free Money",
  mtn_momo: "MTN Mobile Money",
  moov_money: "Moov Money",
  card: "carte bancaire",
};

function listLabels(methods: readonly PaymentMethod[]): string {
  const labels = methods.map((m) => PAYMENT_METHOD_LABELS[m]);
  if (labels.length <= 1) return labels.join("");
  return `${labels.slice(0, -1).join(", ")} et ${labels[labels.length - 1]}`;
}

/** Articles affichés comme raccourcis, dans cet ordre. */
export const FEATURED_ARTICLES: readonly HelpArticleId[] = ["essai", "paiement", "import", "compte"];

export function helpArticles(context: HelpContext): HelpArticle[] {
  return [
    {
      id: "essai",
      title: "Mon essai gratuit",
      body: `L'essai gratuit dure 24 heures. Il démarre à ton premier import de cours, pas à l'inscription.
Pendant l'essai, tu peux : importer 1 document, faire 1 quiz de 5 questions et envoyer 3 messages au professeur. Les appels avec le professeur ne sont pas inclus dans l'essai.
Il y a un seul essai par numéro de téléphone (un par compte pour un compte ouvert avec un e-mail).
Le temps qui reste s'affiche en haut du tableau de bord. À la fin de l'essai, il faut un forfait pour continuer.`,
    },
    {
      id: "paiement",
      title: "S'abonner et payer",
      body: `Les forfaits se paient par mobile money. Moyens de paiement dans ton pays : ${listLabels(context.paymentMethods)}.
Le paiement dans l'application arrive bientôt. En attendant, si tu veux t'abonner, écris à l'équipe avec le bouton « Écrire à l'équipe » du centre d'aide.
Le nombre de quiz, de messages au professeur et de minutes d'appel dépend du forfait choisi.`,
    },
    {
      id: "import",
      title: "Importer un cours",
      body: `Sur le tableau de bord, appuie sur « Importer un cours ». Choisis un module, ou crée-en un, puis un chapitre si tu veux.
Formats acceptés : PDF et Word (.docx), 20 Mo maximum. Les photos ne sont pas acceptées pour l'instant.
Après l'import, ATUMI lit ton document, en général en moins d'une minute. Ensuite tu peux demander une synthèse, faire un quiz ou poser des questions au professeur sur ce cours.
Si le fichier est refusé, vérifie son format et sa taille. Un PDF scanné (une image de page, sans texte sélectionnable) ne peut pas être lu.`,
    },
    {
      id: "synthese-quiz",
      title: "Synthèses et quiz",
      body: `Dans un module, appuie sur « Synthèse et quiz » à côté d'un chapitre pour obtenir un résumé de ton cours. Elle se prépare en une minute environ. Tu peux la copier vers Word, WhatsApp ou d'autres outils.
Le bouton « Faire un quiz » prépare un QCM tiré de ton cours. Chaque quiz se passe une seule fois ; le score s'affiche sous la forme « 3 bonnes réponses sur 8 (38 %) ».
Un quiz dont la préparation a échoué ne compte pas dans ton forfait.
Si tu n'es pas d'accord avec une correction, tu peux la contester : ATUMI te propose de refaire un quiz sur d'autres questions ou d'en parler avec un professeur.`,
    },
    {
      id: "professeur",
      title: "Le professeur IA",
      body: `Le professeur répond à partir de tes cours importés et cite les pages utilisées.
Modes : « Expliquer » (une question précise), « Approfondir le chapitre » (tout un chapitre, étape par étape), « S'exercer » (aide sur un exercice) et « Découvrir un sujet » (un sujet simple, même hors de tes cours).
En mode « S'exercer », le professeur donne la solution seulement après ta propre tentative : il commence par des indices.
Tu peux choisir la langue de réponse : français, anglais ou wolof (bêta) selon ton pays.
Chaque message envoyé au professeur compte dans ton forfait (3 pendant l'essai). Les questions posées au centre d'aide ne comptent pas.`,
    },
    {
      id: "appels",
      title: "Appeler le professeur",
      body: `Avec un forfait qui les inclut, tu peux appeler le professeur IA en voix (vidéo en option). Les minutes d'appel dépendent du forfait. Les appels ne sont pas inclus dans l'essai gratuit.
Seule la transcription écrite de l'appel est gardée ; aucun enregistrement audio ou vidéo n'est conservé.`,
    },
    {
      id: "compte",
      title: "Mon compte et mon mot de passe",
      body: `Pour te connecter, utilise ton e-mail ou ton numéro de téléphone avec ton mot de passe, depuis la page de connexion.
Mot de passe oublié : la réinitialisation dans l'application arrive bientôt. En attendant, écris à l'équipe avec le bouton « Écrire à l'équipe » en précisant ton nom d'utilisateur.
Pour te déconnecter, appuie sur « Me déconnecter » en bas du tableau de bord.
ATUMI est ouvert aux lycéens et aux étudiants.`,
    },
    {
      id: "confidentialite",
      title: "Mes données",
      body: `Tes cours, tes synthèses, tes quiz et tes conversations avec le professeur ne sont visibles que par toi.
ATUMI ne demande jamais le nom de ton établissement.
Tes documents servent uniquement à t'aider : ils ne sont ni publiés ni partagés avec d'autres utilisateurs.`,
    },
  ];
}
