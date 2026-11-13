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
  | "agenda"
  | "bibliotheque"
  | "recherche"
  | "enseignants"
  | "hors-ligne"
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

/** Présentation d'AtumiNeo et du professeur, reprise des textes de la page « Qui est AtumiNeo ? ». */
function presentationBody(locale: Locale = "fr"): string {
  const a = getMessages(locale).about;
  if (locale === "en") {
    return [
      a.intro,
      `Goal: ${a.mission}`,
      `What AtumiNeo does: ${a.roles.join(" ")}`,
      `What AtumiNeo does not do: ${a.limits.join(" ")}`,
      `${a.profIntro} Its modes: ${a.profModes.map((m) => `"${m.title}" (${m.body.replace(/\.$/, "")})`).join(", ")}. ${a.profRule}`,
      'On the home screen, the "I’m Prof NEO" card introduces him (open until you import a course, folded afterwards: tap it to reopen). The "Who is AtumiNeo?" page presents all this: link on the home page and on the dashboard.',
    ].join("\n");
  }
  return [
    a.intro,
    `Objectif : ${a.mission}`,
    `Ce que fait AtumiNeo : ${a.roles.join(" ")}`,
    `Ce qu'AtumiNeo ne fait pas : ${a.limits.join(" ")}`,
    `${a.profIntro} Ses modes : ${a.profModes.map((m) => `« ${m.title} » (${m.body.replace(/\.$/, "")})`).join(", ")}. ${a.profRule}`,
    "Sur l'accueil, la carte « Je suis Prof NEO » le présente (ouverte tant que tu n'as importé aucun cours, repliée ensuite : touche-la pour la rouvrir). La page « Qui est AtumiNeo ? » présente tout cela : lien sur la page d'accueil et sur le tableau de bord.",
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
      title: "Qu'est-ce qu'AtumiNeo ?",
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
Pour t'abonner, ouvre la page « Abonnement » (icône de carte en haut de l'écran sur téléphone, entrée « Abonnement » du menu sur ordinateur, ou lien dans le bandeau de l'accueil) : choisis la durée (1 mois, ou plusieurs mois pour un prix plus bas par mois), puis un forfait : le numéro de l'équipe s'affiche alors, avec un bouton « Copier ». Envoie le montant à ce numéro, puis indique la référence de la transaction (elle est dans le SMS de confirmation). L'équipe vérifie le paiement et active ton forfait, en général dans la journée. Tu suis l'état de ton paiement sur la même page. Les prix et le détail de chaque forfait sont sur la page Abonnement.
Chaque forfait fixe ton espace (cours importés et Ma bibliothèque ensemble), le nombre d'imports, de quiz, de messages au professeur, de recherches web par jour et de minutes d'appel. En haut de la page Abonnement, tu vois ce qu'il te reste.
Recharges : si tu manques de minutes d'appel ou d'espace, achète une recharge dans la rubrique « Recharges » de la page Abonnement, payée de la même façon. Pass de minutes d'appel : valable 3 jours, ses minutes servent après celles du forfait et celles qui restent à la fin du pass sont perdues. L'espace ajouté dure 30 jours. Les recharges complètent un abonnement en cours : elles ne sont pas proposées pendant l'essai.
Enseignants : AtumiNeo convient aussi aux enseignants (choix « Enseignant » à l'inscription), avec les mêmes forfaits : importer ses cours, préparer synthèses et quiz, et partager un défi WhatsApp à toute une classe.`,
    },
    {
      id: "import",
      title: "Importer un cours",
      body: `Sur le tableau de bord, appuie sur « Importer un cours ». Choisis un module, ou crée-en un, puis un chapitre si tu veux.
Formats acceptés : PDF et Word (.docx), 20 Mo maximum, et photos de cours (JPG, PNG, WebP), une photo par page. Sur téléphone, le bouton « Prendre une photo de la page » ouvre l'appareil photo. Si ce bouton n'apparaît pas, la lecture des photos n'est pas encore activée : importe un PDF ou un Word.
Pour une photo nette : page à plat, bien éclairée, sans reflet ni flash, entière dans le cadre, téléphone immobile au-dessus de la page.
Dès que la photo est prise, AtumiNeo vérifie sa netteté sur ton téléphone, en une seconde et sans rien envoyer : « Photo nette : tu peux l'importer », ou bien « Ta photo semble floue » ou « trop sombre », avec le bouton « Reprendre la photo ». Si le texte te paraît lisible, tu peux appuyer sur « Importer quand même ». « Annuler » retire la photo choisie, nette ou non, sans rien importer.
Après l'import, AtumiNeo lit ton document, en général en moins d'une minute. Ensuite tu peux demander une synthèse, faire un quiz ou poser des questions au professeur sur ce cours.
Pour relire un document importé, ouvre son module dans « Mes cours » et appuie sur le nom du document : il s'affiche dans AtumiNeo. Le bouton « Fermer » te ramène au module, et « Télécharger » l'enregistre sur ton appareil.
Après l'import, AtumiNeo relit la photo : si elle est floue, coupée, trop sombre ou ne montre pas de cours, il te demande de la reprendre : importe la nouvelle photo. Un document qui n'a pas pu être lu ne compte pas dans ton nombre d'imports, même pendant l'essai.
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
Si tu n'es pas d'accord avec une correction, tu peux la contester : AtumiNeo te propose de refaire un quiz sur d'autres questions ou d'en parler avec un professeur.
Partager sur WhatsApp : le bouton « WhatsApp » sous une réponse du Prof, une recherche ou une synthèse ouvre WhatsApp avec le texte. Un texte très long part en version courte, suivie de « Lire la suite sur AtumiNeo » : le texte complet est alors lisible sans compte par ceux qui ont le lien, pendant 30 jours, sans ton nom (30 partages longs par jour au plus).
Défi entre amis : après la correction, « Défier un ami sur WhatsApp » envoie un lien. Ton ami passe les mêmes questions sans créer de compte, puis voit son score à côté du tien. Ceux qui reçoivent le lien voient tes questions, ton score et ton prénom, rien d'autre. Sous la correction, « Ils ont relevé ton défi » te montre le prénom et le score de chaque ami. Le défi dure 7 jours ; « Arrêter le défi » le termine avant, et tu peux le relancer avec le même lien. Le défi ne compte pas dans ton forfait.
Compte enseignant : le bouton devient « Partager en quiz d'entraînement sur WhatsApp ». Tes élèves voient les questions, leur note et la correction, jamais ta note, et aucun classement face à toi. Avec le forfait Enseignant, le défi classe cache aussi la correction jusqu'à ce que tu la publies.
Mes quiz : la page « Mes quiz » (menu sur ordinateur, bouton en haut de « Mes cours » sur téléphone) liste tous tes quiz, ta note et les liens encore ouverts, avec « Arrêter » pour fermer un lien.`,
    },
    {
      id: "professeur",
      title: "Le professeur IA",
      body: `Le professeur répond à partir de tes cours importés et cite les pages utilisées.
Modes : « Explication » (une question précise), « Approfondir le chapitre » (tout un chapitre, étape par étape), « S'exercer » (aide sur un exercice) et « Culture générale » (un sujet simple, même hors de tes cours).
En « Explication », « Approfondir le chapitre » et « Culture générale », le professeur explique sur un tableau : formules, symboles, encadrés (définition, exemple, attention, à retenir), schémas, tableaux et, au besoin, images libres de Wikimedia Commons. Le bouton « Plein écran » agrandit le tableau.
En « Explication » et « Approfondir le chapitre », la réponse vient d'abord de ton cours (partie « D'après ton cours »). Sous la réponse, le bouton « Pour aller plus loin » ajoute en bas une suite tirée d'autres sources fiables trouvées sur le web (encyclopédies, universités, institutions), avec les liens des sources. Elle compte comme une recherche web (3 par 24 h pendant l'essai), pas comme un message au professeur.
Si tu demandes l'explication d'un mot ou d'une notion qui n'est pas dans tes cours, le professeur te le dit et propose deux boutons : « Recherche web (IA) » et « Encyclopédie ». Un clic lance la recherche tout de suite, sans retaper ta question. Quand rien n'est trouvé dès ta première question, cette réponse est immédiate et ne compte pas dans tes messages ; la recherche web compte comme une recherche web, l'encyclopédie est gratuite.
Tu peux effacer une conversation (bouton « Effacer ») ou toutes tes conversations (« Tout effacer ») ; les messages envoyés restent comptés dans ton forfait.
En mode « S'exercer », le professeur donne la solution seulement après ta propre tentative : il commence par des indices.
Tu peux choisir la langue de réponse : français ou anglais. Toute l'application passe alors dans cette langue. Au premier lancement, AtumiNeo s'affiche dans la langue de ton pays (français dans les pays francophones, anglais dans les pays anglophones).
Chaque message envoyé au professeur compte dans ton forfait (3 pendant l'essai). Les questions posées au centre d'aide ne comptent pas.`,
    },
    {
      id: "appels",
      title: "Appeler le professeur",
      body: `Les appels voix sont inclus dans les forfaits (des minutes chaque mois) et seront activés très bientôt : l'entrée « Appel Prof NEO » du menu (icône de téléphone) le rappelle.

Avec un forfait qui les inclut, tu peux appeler le Prof NEO en voix : bouton « Appeler le Prof » sur la page du professeur ou dans une conversation. Les minutes d'appel dépendent du forfait ; le temps restant s'affiche pendant l'appel, qui s'arrête tout seul à la fin de tes minutes (30 minutes au plus par appel). Quand tes minutes sont épuisées, le bouton propose « Acheter des minutes » : une recharge sur la page Abonnement. Les appels ne sont pas inclus dans l'essai gratuit.
Tu peux activer la caméra pour montrer ton cahier ou un exercice. Le navigateur te demande l'accès au micro (et à la caméra) la première fois : accepte-le.
Pendant l'appel, tu peux couper le micro ou raccrocher. Le professeur parle en français ou en anglais et suit les mêmes règles qu'à l'écrit : il ne donne la solution d'un exercice qu'après ta propre tentative.
Seule la transcription écrite de l'appel est gardée, dans ta conversation ; aucun enregistrement audio ou vidéo n'est conservé. Elle ne compte pas dans tes messages au professeur.`,
    },
    {
      id: "agenda",
      title: "Mon agenda et mon emploi du temps",
      body: `Le menu a deux entrées : « Agenda » et « Emploi du temps ».
« Agenda » : note tes devoirs, tes examens et tes autres dates (type, quoi, date, heure facultative, note). Coche le rond quand c'est fait. Les échéances sont rangées en « En retard », « Cette semaine », « Plus tard » et « Fait ».
« Emploi du temps » : ajoute tes cours de la semaine (matière, jour, heure de début et de fin, salle facultative). Le jour d'aujourd'hui est signalé. Le bouton « Partager sur WhatsApp » ouvre WhatsApp avec ton emploi du temps déjà écrit : tu choisis à qui l'envoyer (un parent, un camarade). AtumiNeo n'envoie rien tout seul.
Rappels : l'accueil affiche « À ne pas oublier » avec tes échéances en retard et celles des 7 prochains jours. Les rappels par WhatsApp ou par notification ne sont pas encore disponibles.
Chaque échéance et chaque créneau peut être modifié ou supprimé. Si tu supprimes un module, l'échéance reste, sans lien vers le module.
Ton agenda n'est visible que par toi.`,
    },
    {
      id: "bibliotheque",
      title: "Ma bibliothèque",
      body: `« Ma bibliothèque » (menu) range tes livres et documents PDF.
Le « Guide IA pour l'Élève et l'Étudiant 2.0 » est offert par AtumiNeo dans chaque compte.
Abonné : tu peux lire, télécharger, ajouter tes propres PDF (50 Mo au plus par fichier) et les supprimer. Ton espace dépend de ton forfait et est partagé avec tes cours importés ; la barre d'espace montre ce qui est utilisé. Pour plus de place, supprime des fichiers ou prends une recharge d'espace sur la page Abonnement.
Pendant l'essai gratuit : tu peux ouvrir la page et lire les livres offerts, en lecture seule, sans téléchargement ni ajout.
Pour réviser un livre avec le Prof NEO (synthèse, quiz, questions), utilise « Importer » (ou « Importer dans Mes cours » sur la page du livre) : choisis le module et le chapitre, AtumiNeo le copie dans tes cours. Cela compte comme un import de ton forfait (pendant l'essai, c'est ton unique import). Un livre de plus de 60 pages ne peut pas être importé en entier : importe plutôt le chapitre que tu révises.
Tes livres ne sont visibles que par toi.`,
    },
    {
      id: "recherche",
      title: "Recherche : mes cours, le web et les outils",
      body: `La Recherche (loupe en haut de l'écran sur téléphone, entrée « Recherche » du menu sur ordinateur, ou barre de recherche de l'accueil) retrouve un mot ou une notion dans tous tes cours.
Elle cherche dans le contenu des pages de tes documents (avec la page et un extrait où le mot est surligné), dans les noms de tes modules, chapitres et documents, et dans ton agenda.
Écris au moins 2 lettres. Les accents et les majuscules ne comptent pas pour le surlignage ; pour le contenu des pages, la recherche reconnaît aussi les formes proches d'un mot français (pluriel, conjugaison).
Le bouton « Demander au Prof NEO » ouvre le professeur avec ta recherche déjà écrite : tu la relis puis tu l'envoies. Ce message compte comme un message au professeur.
L'onglet « Mes cours » ne compte pas dans ton forfait et ne cherche pas sur Internet : seulement dans ce que tu as importé ou noté.
L'onglet « Web (IA) » pose ta question au Prof NEO, qui cherche sur Internet et répond en citant ses sources (liens cliquables). Le nombre de recherches web est limité par 24 h selon ton forfait (3 pendant l'essai) ; une recherche effacée reste comptée. Pour un exercice, il ne donne pas la solution : il t'envoie vers le Prof NEO. Vérifie toujours les sources. Le bouton « Pour aller plus loin » du Prof NEO utilise aussi une recherche web.
L'onglet « Outils » regroupe une calculatrice scientifique, des conversions d'unités, le tableau périodique, des formules utiles et un dictionnaire et une encyclopédie (définitions du Wiktionnaire et résumés de Wikipédia, affichés directement dans AtumiNeo). Les outils sont gratuits et sans limite.`,
    },
    {
      id: "enseignants",
      title: "AtumiNeo pour les enseignants",
      body: `Les enseignants peuvent utiliser AtumiNeo : à l'inscription, choisissez « Enseignant » dans « Je suis », puis le niveau où vous enseignez (primaire, collège, lycée, école supérieure ou université). Pas d'avis aux parents pour un enseignant. Les forfaits Essentiel, Plus et Premium sont ouverts aux enseignants ; le forfait Enseignant contient tout le Premium et ajoute le défi classe.
Préparer ses cours : importez votre propre cours (PDF, Word ou photo) pour obtenir une synthèse claire et des quiz prêts à l'emploi.
Évaluer sa classe gratuitement : passez d'abord le quiz une fois vous-même, puis appuyez sur « Défier un ami sur WhatsApp » sous la correction et partagez le lien dans le groupe WhatsApp de la classe. Les élèves répondent sans compte et voient la correction ; vous voyez leurs prénoms et leurs scores sous votre correction (100 participations au plus par défi). Le défi reste ouvert 7 jours et peut être arrêté avant.
Défi classe (forfait Enseignant seulement) : les élèves voient seulement leur propre score, ni le vôtre ni la correction ; jusqu'à 300 élèves par défi. Sous votre correction, « Résultats de la classe » liste les prénoms et scores. Quand vous voulez, appuyez sur « Publier la correction » : le défi se ferme et le même lien montre la correction à tous ; le bouton « Envoyer la correction sur WhatsApp » prévient la classe.
Approfondir : Prof NEO (modes Explication, Approfondir le chapitre, Culture générale) et la recherche web avec ses sources aident à préparer une explication, un exemple ou un schéma.
Organiser : agenda, emploi du temps et Ma bibliothèque pour ranger vos PDF.
Pas encore disponible : espace classe, suivi individuel des élèves, correction de copies.`,
    },
    {
      id: "hors-ligne",
      title: "Utiliser AtumiNeo sans connexion",
      body: `AtumiNeo a besoin d'Internet pour le Prof NEO, les quiz, l'import de cours, la recherche web, les appels et le paiement : ces parties ne marchent pas hors ligne.
Sans connexion, tu peux relire les pages déjà ouvertes sur cet appareil : synthèses, cours, quiz corrigés, réponses du Prof NEO, agenda, emploi du temps, Recherche (dont les outils : calculatrice, conversions, tableau périodique, formules) et les livres de Ma bibliothèque déjà lus. Un bandeau « Pas de connexion » s'affiche alors en haut de l'écran.
Pour préparer une révision sans réseau : quand tu es connecté, ouvre les synthèses et corrections dont tu auras besoin. AtumiNeo garde les 60 dernières pages ouvertes et les 5 derniers livres lus.
Une page jamais ouverte sur l'appareil affiche « Pas de connexion », avec la liste de ce qui est disponible et le bouton « Réessayer ».
Ce que tu as noté hors ligne n'est pas enregistré : attends la connexion pour ajouter une échéance ou répondre à un quiz.
Sécurité : les pages gardées restent sur ton appareil et sont effacées quand tu te déconnectes, ou après 1 h sans activité. Elles ne marchent que dans le navigateur ou l'appli installée où tu les as ouvertes.`,
    },
    {
      id: "compte",
      title: "Mon compte et mon mot de passe",
      body: `Pour te connecter, utilise ton adresse e-mail et ton mot de passe, depuis la page de connexion. L'inscription se fait avec une adresse e-mail : ouvre le lien de confirmation reçu (regarde aussi dans les courriers indésirables), sinon la connexion est refusée ; « Renvoyer le lien de confirmation » en envoie un nouveau. L'inscription par numéro de téléphone arrive bientôt.
Mot de passe oublié : sur la page de connexion, appuie sur « Mot de passe oublié ? » et saisis l'adresse e-mail de ton compte. Tu recevras un lien pour choisir un nouveau mot de passe. Pour un compte créé avec un numéro de téléphone, la réinitialisation par SMS arrive bientôt : en attendant, écris à l'équipe en précisant ton prénom et ton nom.
Pour te déconnecter : sur téléphone, l'icône de sortie en haut à droite de l'écran ; sur ordinateur, « Me déconnecter » en bas du menu.
Photo de profil (facultative) : sur l'accueil, appuie sur le rond avec tes initiales pour ajouter ta photo (JPG, PNG ou WebP), puis dessus à nouveau pour la changer ou la retirer. Elle est recadrée en carré et reste privée : toi seul la vois.
Pour protéger ton compte, AtumiNeo te déconnecte automatiquement après 1 h sans activité (appli fermée ou laissée ouverte sans y toucher). Il suffit de te reconnecter.
Langue de l'interface : boutons « FR » et « EN » en haut de l'écran sur téléphone, en bas du menu sur ordinateur, et sur les pages de connexion.
Le menu (en bas sur téléphone, à gauche sur ordinateur) mène à toutes les parties d'AtumiNeo : Accueil, Mes cours, Importer, Prof NEO, Agenda, Emploi du temps et Aide ; la Recherche, l'Appel et l'Abonnement sont des icônes en haut de l'écran sur téléphone et des entrées du menu sur ordinateur. La langue de réponse du professeur se choisit à part, sur la page « Prof NEO ».
AtumiNeo est ouvert aux lycéens et aux étudiants.
L'inscription demande ton âge. Un élève de moins de 18 ans indique le numéro d'un parent : ce parent reçoit un message qui le prévient et lui permet de refuser l'inscription. En cas de refus, le compte est suspendu.`,
    },
    {
      id: "confidentialite",
      title: "Mes données",
      body: `Tes cours, tes synthèses, tes quiz et tes conversations avec le professeur ne sont visibles que par toi, sauf un quiz que tu choisis de partager en défi (questions, score et prénom).
AtumiNeo ne demande jamais le nom de ton établissement.
Tes documents servent uniquement à t'aider : ils ne sont ni publiés ni partagés avec d'autres utilisateurs.
Le détail (données recueillies, prestataires, durée de conservation, tes droits) est dans la politique de confidentialité, page /confidentialite ; les règles d'utilisation, de paiement et de remboursement sont dans les conditions, page /conditions. Pour accéder à tes données, les corriger ou les supprimer, ou fermer ton compte : écris à l'équipe depuis le centre d'aide.`,
    },
  ];
}

function helpArticlesEn(context: HelpContext): HelpArticle[] {
  return [
    {
      id: "presentation",
      title: "What is AtumiNeo?",
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
To subscribe, open the "Subscription" page (card icon at the top of the screen on a phone, "Subscription" in the menu on a computer, or the link in the banner on the home page): choose the duration (1 month, or several months for a lower price per month), then a plan: the team's number then appears, with a "Copy" button. Send the amount to this number, then enter the transaction reference (it is in the confirmation SMS). The team checks the payment and activates your plan, usually within the day. You can follow your payment's status on the same page. Prices and the details of each plan are on the Subscription page.
Each plan sets your space (imported courses and My library together), the number of imports, quizzes, messages to the teacher, web searches per day and call minutes. The top of the Subscription page shows what you have left.
Top-ups: if you run out of call minutes or space, buy a top-up in the "Top-ups" section of the Subscription page, paid the same way. Call minute pass: valid 3 days, its minutes are used after your plan's minutes and those left when the pass ends are lost. Added space lasts 30 days. Top-ups add to an active subscription: they are not offered during the trial.
Teachers: AtumiNeo also suits teachers ("A teacher" at sign-up), with the same plans: import your courses, prepare summaries and quizzes, and share a WhatsApp challenge with a whole class.`,
    },
    {
      id: "import",
      title: "Importing a course",
      body: `On the dashboard, tap "Import a course". Choose a module, or create one, then a chapter if you want.
Accepted formats: PDF and Word (.docx), 20 MB maximum, and course photos (JPG, PNG, WebP), one photo per page. On a phone, the "Take a photo of the page" button opens the camera. If this button does not appear, reading photos is not enabled yet: import a PDF or Word file.
For a sharp photo: page flat, well lit, no glare or flash, fully in the frame, phone held still above the page.
As soon as the photo is taken, AtumiNeo checks it is sharp on your phone, in a second and without sending anything: "Sharp photo: you can import it", or "Your photo looks blurry" or "too dark", with a "Retake the photo" button. If the text looks readable to you, you can tap "Import anyway". "Cancel" removes the chosen photo, sharp or not, without importing anything.
After the import, AtumiNeo reads your document, usually in less than a minute. Then you can ask for a summary, take a quiz or ask the teacher questions about this course.
To read an imported document again, open its module in "My courses" and tap the document's name: it opens in AtumiNeo. The "Close" button takes you back to the module, and "Download" saves it on your device.
After the import, AtumiNeo reads the photo again: if it is blurry, cut off, too dark or does not show a course, it asks you to retake it: import the new photo. A document that could not be read does not count in your number of imports, even during the trial.
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
If you disagree with a correction, you can dispute it: AtumiNeo suggests taking a new quiz with other questions or talking it over with a teacher.
Share on WhatsApp: the "WhatsApp" button under a teacher's answer, a search or a summary opens WhatsApp with the text. A very long text is sent shortened, followed by "Read more on AtumiNeo": the full text can then be read without an account by anyone with the link, for 30 days, without your name (at most 30 long shares per day).
Challenge a friend: after the correction, "Challenge a friend on WhatsApp" sends a link. Your friend takes the same questions without creating an account, then sees their score next to yours. People who get the link see your questions, your score and your first name, nothing else. Under the correction, "They took your challenge" shows each friend's name and score. The challenge lasts 7 days; "Stop the challenge" ends it earlier, and you can restart it with the same link. The challenge does not count against your plan.
Teacher account: the button becomes "Share as a practice quiz on WhatsApp". Your students see the questions, their mark and the correction, never your mark, and no ranking against you. With the Teacher plan, the class challenge also hides the correction until you publish it.
My quizzes: the "My quizzes" page (menu on computer, button at the top of "My courses" on phone) lists all your quizzes, your mark and the links still open, with "Stop" to close a link.`,
    },
    {
      id: "professeur",
      title: "The AI teacher",
      body: `The teacher answers from your imported courses and cites the pages used.
Modes: "Explanation" (a specific question), "Go deeper into the chapter" (a whole chapter, step by step), "Practise" (help with an exercise) and "General knowledge" (a simple topic, even outside your courses).
In "Explanation", "Go deeper into the chapter" and "General knowledge", the teacher explains on a board: formulas, symbols, boxes (definition, example, watch out, key points), diagrams, tables and, when useful, free images from Wikimedia Commons. The "Full screen" button enlarges the board.
In "Explanation" and "Go deeper into the chapter", the answer first comes from your course ("From your course" part). Below the answer, the "Go further" button adds at the bottom a follow-up based on other reliable sources found on the web (encyclopaedias, universities, institutions), with links to the sources. It counts as one web search (3 per 24 h during the trial), not as a message to the teacher.
If you ask for an explanation of a word or idea that is not in your courses, the teacher tells you and offers two buttons: "Web search (AI)" and "Encyclopaedia". One tap starts the search right away, without typing your question again. When nothing is found from your first question, this answer is instant and does not count in your messages; the web search counts as one web search, the encyclopaedia is free.
You can erase a conversation ("Erase" button) or all your conversations ("Erase all"); the messages you sent still count in your plan.
In "Practise" mode, the teacher gives the solution only after your own attempt: it starts with hints.
You can choose the language of the answers: French or English. The whole app then switches to that language. On first launch, AtumiNeo shows in your country's language (French in French-speaking countries, English in English-speaking ones).
Each message sent to the teacher counts in your plan (3 during the trial). Questions asked in the help centre do not count.`,
    },
    {
      id: "appels",
      title: "Calling the teacher",
      body: `Voice calls are included in the plans (minutes each month) and will be switched on very soon: the "Call Prof NEO" menu entry (phone icon) says so.

With a plan that includes them, you can call Prof NEO by voice: the "Call the Prof" button on the teacher page or in a conversation. Call minutes depend on the plan; the time left is shown during the call, which stops by itself when your minutes run out (30 minutes at most per call). When your minutes run out, the button offers "Buy minutes": a top-up on the Subscription page. Calls are not included in the free trial.
You can turn on the camera to show your notebook or an exercise. The browser asks for access to the microphone (and camera) the first time: accept it.
During the call, you can mute the microphone or hang up. The teacher speaks French or English and follows the same rules as in writing: it gives the solution to an exercise only after your own attempt.
Only the written transcript of the call is kept, in your conversation; no audio or video recording is stored. It does not count towards your messages to the teacher.`,
    },
    {
      id: "agenda",
      title: "My planner and timetable",
      body: `The menu has two entries: "Planner" and "Timetable".
"Planner": write down your homework, exams and other dates (type, what, date, optional time, note). Tick the circle when it is done. Deadlines are sorted into "Overdue", "This week", "Later" and "Done".
"Timetable": add your classes for the week (subject, day, start and end time, optional room). Today is highlighted. The "Share on WhatsApp" button opens WhatsApp with your timetable already written: you choose who to send it to (a parent, a classmate). AtumiNeo sends nothing on its own.
Reminders: the home page shows "Don't forget" with your overdue deadlines and those in the next 7 days. Reminders by WhatsApp or notification are not available yet.
Every deadline and class can be edited or deleted. If you delete a module, the deadline stays, without a link to the module.
Only you can see your planner.`,
    },
    {
      id: "bibliotheque",
      title: "My library",
      body: `"My library" (menu) keeps your books and PDF documents.
The "Guide IA pour l'Élève et l'Étudiant 2.0" (in French) is offered by AtumiNeo in every account.
Subscriber: you can read, download, add your own PDFs (50 MB at most per file) and delete them. Your space depends on your plan and is shared with your imported courses; the space bar shows what is used. For more room, delete files or buy a space top-up on the Subscription page.
During the free trial: you can open the page and read the offered books, read-only, with no download or upload.
To revise a book with Prof NEO (summary, quiz, questions), use "Import" (or "Import into My courses" on the book page): choose the module and chapter, and AtumiNeo copies it into your courses. It counts as one import of your plan (during the trial, it is your only import). A book of more than 60 pages cannot be imported whole: import the chapter you are revising instead.
Your books are visible only to you.`,
    },
    {
      id: "recherche",
      title: "Search: my courses, the web and tools",
      body: `Search (the magnifying glass at the top of the screen on a phone, the "Search" menu entry on a computer, or the search bar on the home page) finds a word or topic across all your courses.
It looks in the content of your documents' pages (with the page and an excerpt where the word is highlighted), in the names of your modules, chapters and documents, and in your planner.
Type at least 2 letters. Accents and capital letters do not matter for highlighting; for page content, search also recognises close forms of a French word (plural, conjugation).
The "Ask Prof NEO" button opens the teacher with your search already written: you check it, then send it. That message counts as a message to the teacher.
The "My courses" tab does not count towards your plan and does not search the Internet: only what you imported or wrote down.
The "Web (AI)" tab asks Prof NEO, who searches the Internet and answers with its sources (clickable links). Web searches are limited per 24 hours depending on your plan (3 during the trial); a deleted search still counts. For an exercise, it does not give the solution: it sends you to Prof NEO. Always check the sources. Prof NEO's "Go further" button also uses a web search.
The "Tools" tab gathers a scientific calculator, unit conversions, the periodic table, useful formulas and a dictionary and an encyclopedia (Wiktionary definitions and Wikipedia summaries, shown directly in AtumiNeo). Tools are free and unlimited.`,
    },
    {
      id: "enseignants",
      title: "AtumiNeo for teachers",
      body: `Teachers can use AtumiNeo: when signing up, choose "A teacher" under "I am", then the level you teach (primary school, middle school, high school, higher education school or university). No parent notice for a teacher. The Essentiel, Plus and Premium plans are open to teachers; the Teacher plan includes all of Premium and adds the class challenge.
Prepare lessons: import your own course (PDF, Word or photo) to get a clear summary and ready-to-use quizzes.
Assess your class for free: take the quiz once yourself first, then tap "Challenge a friend on WhatsApp" under the correction and share the link in the class WhatsApp group. Students answer without an account and see the correction; you see their first names and scores under your correction (100 plays at most per challenge). The challenge stays open 7 days and can be stopped earlier.
Class challenge (Teacher plan only): students only see their own score, neither yours nor the correction; up to 300 students per challenge. Under your correction, "Class results" lists first names and scores. When you want, tap "Publish the correction": the challenge closes and the same link shows the correction to everyone; the "Send the correction on WhatsApp" button lets the class know.
Go deeper: Prof NEO (Explanation, Go deeper into the chapter, General knowledge modes) and web search with sources help you prepare an explanation, an example or a diagram.
Get organised: planner, timetable and My library for your PDFs.
Not available yet: class space, individual student tracking, marking work.`,
    },
    {
      id: "hors-ligne",
      title: "Using AtumiNeo without a connection",
      body: `AtumiNeo needs the Internet for Prof NEO, quizzes, course imports, web search, calls and payment: these parts do not work offline.
Without a connection, you can reread pages already opened on this device: summaries, courses, corrected quizzes, Prof NEO answers, planner, timetable, Search (including the tools: calculator, conversions, periodic table, formulas) and books from My library you already read. A "No connection" banner then shows at the top of the screen.
To prepare revision without a network: while online, open the summaries and corrections you will need. AtumiNeo keeps the last 60 pages opened and the last 5 books read.
A page never opened on the device shows "No connection", with the list of what is available and a "Try again" button.
Anything entered offline is not saved: wait for the connection to add a deadline or answer a quiz.
Security: saved pages stay on your device and are erased when you sign out, or after 1 hour without activity. They only work in the browser or installed app where you opened them.`,
    },
    {
      id: "compte",
      title: "My account and password",
      body: `To sign in, use your email address and password, from the sign-in page. Sign-up uses an email address: open the confirmation link you receive (check your spam folder too), otherwise sign-in is refused; "Resend the confirmation link" sends a new one. Sign-up with a phone number is coming soon.
Forgot your password: on the sign-in page, tap "Forgot your password?" and enter your account's email address. You will receive a link to choose a new password. For an account created with a phone number, reset by SMS is coming soon: meanwhile, write to the team and give your first and last name.
To sign out: on a phone, the exit icon at the top right of the screen; on a computer, "Sign out" at the bottom of the menu.
Profile photo (optional): on the home page, tap the circle with your initials to add your photo (JPG, PNG or WebP), then tap it again to change or remove it. It is cropped to a square and stays private: only you can see it.
To protect your account, AtumiNeo signs you out automatically after 1 hour without activity (app closed or left open untouched). Just sign in again.
Interface language: "FR" and "EN" buttons at the top of the screen on a phone, at the bottom of the menu on a computer, and on the sign-in pages.
The menu (at the bottom on a phone, on the left on a computer) leads to every part of AtumiNeo: Home, My courses, Import, Prof NEO, Planner, Timetable and Help; Search, Call and Subscription are icons at the top of the screen on a phone and menu entries on a computer. The teacher's answer language is chosen separately, on the "Prof NEO" page.
AtumiNeo is open to high school and university students. Sign-up asks for your age. A student under 18 gives a parent's number: the parent receives a message about the sign-up, with a link to refuse it. If they refuse, the account is suspended.`,
    },
    {
      id: "confidentialite",
      title: "My data",
      body: `Your courses, summaries, quizzes and conversations with the teacher are visible only to you, except a quiz you choose to share as a challenge (questions, score and first name).
AtumiNeo never asks for the name of your school.
Your documents are used only to help you: they are neither published nor shared with other users.
The details (data collected, providers, retention, your rights) are in the privacy policy, page /confidentialite; the rules for use, payment and refunds are in the terms, page /conditions. To access, correct or delete your data, or close your account: write to the team from the help centre.`,
    },
  ];
}
