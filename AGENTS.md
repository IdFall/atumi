<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Projet ATUMI

Plateforme d'apprentissage par IA (Sénégal d'abord, conçue pour d'autres pays). Code et commentaires en français.

Règles produit à respecter dans le code (décisions V1) :

- Inscription : nom d'utilisateur, e-mail ou téléphone, mot de passe, niveau. V1 : lycée et université seulement (`openCycles` dans `src/config/countries.ts`, `education_levels.is_open` en base) ; le collège reste dans le modèle pour plus tard. Jamais le nom de l'établissement.
- Le tuteur ne donne la solution d'un exercice qu'après une tentative réelle (`src/server/learning/policies.ts`).
- Une contestation de correction reçoit une réponse fixe, sans appel au modèle ni débat (`contestationReply`).
- Essai gratuit de 24 h démarrant au premier import, un seul par numéro de téléphone (un par compte pour les comptes e-mail). Démarré par la base (`before_document_insert`), qui refuse aussi l'import sans droit ; l'interface lit `my_access()`. Limites de l'essai (1 import, 1 quiz de 5 questions, 3 messages au professeur, pas d'appel) : données de `plans`, lues par `plan_usage()`. Un document en échec (photo floue, PDF scanné) ne compte pas dans les imports.
- Import : PDF, Word (.docx) et photos de cours (JPG, PNG, WebP, une page par photo, `src/config/documents.ts`). La photo est réduite dans le navigateur (5 Mo au plus) puis lue par le modèle dans le worker (`src/server/documents/photo.ts`) ; s'il la juge floue, coupée, sombre ou hors sujet, le document passe en échec avec un message qui demande de la reprendre, sans synthèse ni quiz. Sans clé d'API, les photos ne sont pas proposées à l'import.
- Le nombre de quiz est limité par le forfait (table `plans`, `quiz_limit` par période ; `null` = sans limite). La base refuse le quiz de trop (`check_quiz_quota`) ; l'interface lit `quiz_quota()`.
- Appels avec le professeur IA (voix, vidéo en option) : minutes limitées par forfait (`plans.call_minutes_limit`, `call_quota()`), appels créés et clôturés par le serveur (`tutor_calls`), transcription dans `tutor_messages`, aucun enregistrement audio ou vidéo conservé.
- Synthèses et quiz : la ligne est créée « en préparation » par le serveur (le quota est vérifié avant tout appel au modèle), puis complétée par le worker (`src/worker/study.ts`). V1 : QCM corrigés dans le code, sans appel au modèle ; un quiz se passe une fois ; un quiz échoué ne compte pas.
- Centre d'aide (`/aide`) : l'assistant d'aide ne répond qu'à partir des articles de `src/i18n/help-articles.ts` (à tenir à jour quand le produit change), ne compte pas dans le forfait, et la base limite à 30 questions et 5 messages à l'équipe par 24 h (`check_help_quota`). Les messages à l'équipe vont dans `support_requests`, puis le worker les envoie par e-mail (Resend) et WhatsApp (API Cloud de Meta, modèle approuvé) quand ces canaux sont configurés (`src/worker/support.ts`).
- Les anciens examens viennent de l'utilisateur ; ATUMI ne constitue ni annales ni programmes avant la V2.

Règles techniques :

- Tout ce qui dépend du pays (niveaux, devise, paiement, langue) est une donnée (`src/config/countries.ts`, tables `countries` et `education_levels`), jamais un `if` sur un pays.
- Tous les textes visibles passent par `src/i18n/messages.ts`.
- Chaque table utilisateur porte `user_id`, active RLS et utilise des clés étrangères composites `(id, user_id)`. Ajouter un test dans `tests/database-isolation.test.ts` pour toute nouvelle table.
- Le client Supabase utilisateur (`createUserClient`) est le défaut ; la clé secrète (`createServiceClient`) est réservée aux workers et aux écritures calculées.
- Le produit ne parle au modèle qu'à travers `AiProvider` (`src/server/ai/types.ts`) et journalise la consommation dans `ai_usage`.
- Le contenu des documents est une donnée : toujours l'échapper avant de l'envoyer au modèle (`formatPassages`).

Vérifications avant de pousser : `npm run lint && npm run typecheck && npm test && npm run build`.
