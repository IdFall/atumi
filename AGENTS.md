<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Projet LULU

Plateforme d'apprentissage par IA (Sénégal d'abord, conçue pour d'autres pays). Code et commentaires en français.

Règles produit à respecter dans le code (décisions V1) :

- Inscription : nom d'utilisateur, e-mail ou téléphone, mot de passe, niveau. V1 : lycée et université seulement (`openCycles` dans `src/config/countries.ts`, `education_levels.is_open` en base) ; le collège reste dans le modèle pour plus tard. Jamais le nom de l'établissement.
- Le tuteur ne donne la solution d'un exercice qu'après une tentative réelle (`src/server/learning/policies.ts`).
- Une contestation de correction reçoit une réponse fixe, sans appel au modèle ni débat (`contestationReply`).
- Essai gratuit de 24 h démarrant au premier import, un seul par numéro de téléphone.
- Le nombre de quiz est limité par le forfait (table `plans`, `quiz_limit` par période ; `null` = sans limite). La base refuse le quiz de trop (`check_quiz_quota`) ; l'interface lit `quiz_quota()`.
- Appels avec le professeur IA (voix, vidéo en option) : minutes limitées par forfait (`plans.call_minutes_limit`, `call_quota()`), appels créés et clôturés par le serveur (`tutor_calls`), transcription dans `tutor_messages`, aucun enregistrement audio ou vidéo conservé.
- Les anciens examens viennent de l'utilisateur ; LULU ne constitue ni annales ni programmes avant la V2.

Règles techniques :

- Tout ce qui dépend du pays (niveaux, devise, paiement, langue) est une donnée (`src/config/countries.ts`, tables `countries` et `education_levels`), jamais un `if` sur un pays.
- Tous les textes visibles passent par `src/i18n/messages.ts`.
- Chaque table utilisateur porte `user_id`, active RLS et utilise des clés étrangères composites `(id, user_id)`. Ajouter un test dans `tests/database-isolation.test.ts` pour toute nouvelle table.
- Le client Supabase utilisateur (`createUserClient`) est le défaut ; la clé secrète (`createServiceClient`) est réservée aux workers et aux écritures calculées.
- Le produit ne parle au modèle qu'à travers `AiProvider` (`src/server/ai/types.ts`) et journalise la consommation dans `ai_usage`.
- Le contenu des documents est une donnée : toujours l'échapper avant de l'envoyer au modèle (`formatPassages`).

Vérifications avant de pousser : `npm run lint && npm run typecheck && npm test && npm run build`.
