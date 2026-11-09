/**
 * Articles du centre d'aide. L'assistant d'aide ne répond qu'à partir de ces
 * textes : les garder exacts quand le produit change.
 *
 * Ce qui dépend du pays (moyens de paiement) est injecté depuis la
 * configuration du pays, jamais écrit en dur.
 */
import type { Locale, PaymentMethod } from "@/config/countries";
import { getMessages } from "@/i18n/messages";

export type HelpArticleId =
  | "presentation"
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

const CARD_LABEL: Record<Locale, string> = { fr: "carte bancaire", en: "bank card" };
const AND: Record<Locale, string> = { fr: "et", en: "and" };

function listLabels(methods: readonly PaymentMethod[], locale: Locale = "fr"): string {
  const labels = methods.map((m) => (m === "card" ? CARD_LABEL[locale] : PAYMENT_METHOD_LABELS[m]));
  if (labels.length <= 1) return labels.join("");
  return `${labels.slice(0, -1).join(", ")} ${AND[locale]} ${labels[labels.length - 1]}`;
}

/** Articles affichés comme raccourcis, dans cet ordre. */
export const FEATURED_ARTICLES: readonly HelpArticleId[] = ["presentation", "essai", "paiement", "import", "compte"];

/** Présentation d'ATUMI et du professeur, reprise des textes de la page « Qui est ATUMI ? ». */
function presentationBody(locale: Locale = "fr"): string {
  const a = getMessages(locale).about;
  if (locale === "en") {
    return [
      a.intro,
      `Goal: ${a.mission}`,
      `What ATUMI does: ${a.roles.join(" ")}`,
      `What ATUMI does not do: ${a.limits.join(" ")}`,
      `${a.profIntro} Its modes: ${a.profModes.map((m) => `"${m.title}" (${m.body.replace(/\.$/, "")})`).join(", ")}. ${a.profRule}`,
      'The "Who is ATUMI?" page presents all this: link on the home page and on the dashboard.',
    ].join("\n");
  }
  return [
    a.intro,
    `Objectif : ${a.mission}`,
    `Ce que fait ATUMI : ${a.roles.join(" ")}`,
    `Ce qu'ATUMI ne fait pas : ${a.limits.join(" ")}`,
    `${a.profIntro} Ses modes : ${a.profModes.map((m) => `« ${m.title} » (${m.body.replace(/\.$/, "")})`).join(", ")}. ${a.profRule}`,
    "La page « Qui est ATUMI ? » présente tout cela : lien sur la page d'accueil et sur le tableau de bord.",
  ].join("\n");
}

/** Articles dans la langue de l'interface (français par défaut). */
export function helpArticles(context: HelpContext, locale: Locale = "fr"): HelpArticle[] {
  return locale === "en" ? helpArticlesEn(context) : helpArticlesFr(context);
}

function helpArticlesFr(context: HelpContext): HelpArticle[] {
  return [
    {
      id: "presentation",
      title: "Qu'est-ce qu'ATUMI ?",
      body: presentationBody(),
    },
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
Formats acceptés : PDF et Word (.docx), 20 Mo maximum, et photos de cours (JPG, PNG, WebP), une photo par page. Sur téléphone, le bouton « Prendre une photo de la page » ouvre l'appareil photo. Si ce bouton n'apparaît pas, la lecture des photos n'est pas encore activée : importe un PDF ou un Word.
Pour une photo nette : page à plat, bien éclairée, sans reflet ni flash, entière dans le cadre, téléphone immobile au-dessus de la page.
Après l'import, ATUMI lit ton document, en général en moins d'une minute. Ensuite tu peux demander une synthèse, faire un quiz ou poser des questions au professeur sur ce cours.
Pour relire un document importé, ouvre son module dans « Mes cours » et appuie sur le nom du document : il s'affiche dans ATUMI. Le bouton « Fermer » te ramène au module, et « Télécharger » l'enregistre sur ton appareil.
Si la photo est floue, coupée, trop sombre ou ne montre pas de cours, ATUMI te demande de la reprendre : importe la nouvelle photo. Un document qui n'a pas pu être lu ne compte pas dans ton nombre d'imports, même pendant l'essai.
Si le fichier est refusé, vérifie son format et sa taille. Un PDF scanné (une image de page, sans texte sélectionnable) ne peut pas être lu : prends plutôt les pages en photo.
Dans « Mes cours », chaque module indique l'étape suivante : importer un cours, lecture en cours, ou « Faire la synthèse et le quiz ».
Pour renommer ou supprimer un module, un chapitre ou un document, utilise les boutons « Modifier » et « Supprimer » dans « Mes cours ». Supprimer un chapitre supprime aussi ses documents. La suppression est définitive et ne redonne pas d'import : un document supprimé reste compté dans ton forfait.`,
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
Modes : « Explication » (une question précise), « Approfondir le chapitre » (tout un chapitre, étape par étape), « S'exercer » (aide sur un exercice) et « Culture générale » (un sujet simple, même hors de tes cours).
Tu peux effacer une conversation (bouton « Effacer ») ou toutes tes conversations (« Tout effacer ») ; les messages envoyés restent comptés dans ton forfait.
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
Mot de passe oublié : sur la page de connexion, appuie sur « Mot de passe oublié ? » et saisis l'adresse e-mail de ton compte. Tu recevras un lien pour choisir un nouveau mot de passe. Pour un compte créé avec un numéro de téléphone, la réinitialisation par SMS arrive bientôt : en attendant, écris à l'équipe en précisant ton nom d'utilisateur.
Pour te déconnecter, appuie sur « Me déconnecter » en bas du tableau de bord.
Langue de l'interface : boutons « FR » et « EN » sur le tableau de bord et sur les pages de connexion. La langue de réponse du professeur se choisit à part, sur la page « Prof ATUMI ».
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

function helpArticlesEn(context: HelpContext): HelpArticle[] {
  return [
    {
      id: "presentation",
      title: "What is ATUMI?",
      body: presentationBody("en"),
    },
    {
      id: "essai",
      title: "My free trial",
      body: `The free trial lasts 24 hours. It starts with your first course import, not when you sign up.
During the trial, you can: import 1 document, take 1 quiz of 5 questions and send 3 messages to the teacher. Calls with the teacher are not included in the trial.
There is only one trial per phone number (one per account for an account opened with an email).
The time left is shown at the top of the dashboard. When the trial ends, you need a plan to continue.`,
    },
    {
      id: "paiement",
      title: "Subscribing and paying",
      body: `Plans are paid by mobile money. Payment methods in your country: ${listLabels(context.paymentMethods, "en")}.
In-app payment is coming soon. Meanwhile, if you want to subscribe, write to the team with the "Write to the team" button in the help centre.
The number of quizzes, messages to the teacher and call minutes depends on the plan you choose.`,
    },
    {
      id: "import",
      title: "Importing a course",
      body: `On the dashboard, tap "Import a course". Choose a module, or create one, then a chapter if you want.
Accepted formats: PDF and Word (.docx), 20 MB maximum, and course photos (JPG, PNG, WebP), one photo per page. On a phone, the "Take a photo of the page" button opens the camera. If this button does not appear, reading photos is not enabled yet: import a PDF or Word file.
For a sharp photo: page flat, well lit, no glare or flash, fully in the frame, phone held still above the page.
After the import, ATUMI reads your document, usually in less than a minute. Then you can ask for a summary, take a quiz or ask the teacher questions about this course.
To read an imported document again, open its module in "My courses" and tap the document's name: it opens in ATUMI. The "Close" button takes you back to the module, and "Download" saves it on your device.
If the photo is blurry, cut off, too dark or does not show a course, ATUMI asks you to retake it: import the new photo. A document that could not be read does not count in your number of imports, even during the trial.
If the file is rejected, check its format and size. A scanned PDF (an image of a page, with no selectable text) cannot be read: take photos of the pages instead.
In "My courses", each module shows the next step: import a course, reading in progress, or "Get the summary and the quiz".
To rename or delete a module, a chapter or a document, use the "Edit" and "Delete" buttons in "My courses". Deleting a chapter also deletes its documents. Deleting cannot be undone and does not give an import back: a deleted document still counts in your plan.`,
    },
    {
      id: "synthese-quiz",
      title: "Summaries and quizzes",
      body: `In a module, tap "Get the summary and the quiz" next to a chapter to get a summary of your course. It takes about a minute to prepare. You can copy it to Word, WhatsApp or other tools.
The "Take a quiz" button prepares a multiple-choice quiz from your course. Each quiz can be taken only once; the score is shown as "3 correct answers out of 8 (38%)".
A quiz whose preparation failed does not count in your plan.
If you disagree with a correction, you can dispute it: ATUMI suggests taking a new quiz with other questions or talking it over with a teacher.`,
    },
    {
      id: "professeur",
      title: "The AI teacher",
      body: `The teacher answers from your imported courses and cites the pages used.
Modes: "Explanation" (a specific question), "Go deeper into the chapter" (a whole chapter, step by step), "Practise" (help with an exercise) and "General knowledge" (a simple topic, even outside your courses).
You can erase a conversation ("Erase" button) or all your conversations ("Erase all"); the messages you sent still count in your plan.
In "Practise" mode, the teacher gives the solution only after your own attempt: it starts with hints.
You can choose the language of the answers: French, English or Wolof (beta) depending on your country.
Each message sent to the teacher counts in your plan (3 during the trial). Questions asked in the help centre do not count.`,
    },
    {
      id: "appels",
      title: "Calling the teacher",
      body: `With a plan that includes them, you can call the AI teacher by voice (video optional). Call minutes depend on the plan. Calls are not included in the free trial.
Only the written transcript of the call is kept; no audio or video recording is stored.`,
    },
    {
      id: "compte",
      title: "My account and password",
      body: `To sign in, use your email or phone number with your password, from the sign-in page.
Forgot your password: on the sign-in page, tap "Forgot your password?" and enter your account's email address. You will receive a link to choose a new password. For an account created with a phone number, reset by SMS is coming soon: meanwhile, write to the team and give your username.
To sign out, tap "Sign out" at the bottom of the dashboard.
Interface language: "FR" and "EN" buttons on the dashboard and on the sign-in pages. The teacher's answer language is chosen separately, on the "Prof ATUMI" page.
ATUMI is open to high school and university students.`,
    },
    {
      id: "confidentialite",
      title: "My data",
      body: `Your courses, summaries, quizzes and conversations with the teacher are visible only to you.
ATUMI never asks for the name of your school.
Your documents are used only to help you: they are neither published nor shared with other users.`,
    },
  ];
}
