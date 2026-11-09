# Architecture de ATUMI (V1)

## Vue d'ensemble

```
Navigateur (PWA)
   │  HTTPS
   ▼
Next.js : pages + routes API  ──►  Supabase Auth
   │            │
   │            ├──► PostgreSQL (RLS, pgvector)  ◄── worker(s)
   │            │                                     │
   │            └──► File pg-boss  ───────────────────┘
   │                                                  │
   └──► Stockage objet privé (documents)              └──► Fournisseur IA (AiProvider)
```

Un monolithe découpé en modules (comptes, documents, IA, quiz, paiement). L'API est sans état : on ajoute des instances pendant les pics. Les traitements lourds passent par la file et des workers qu'on multiplie indépendamment.

## Boucle produit

1. **Importer** : le fichier va dans le stockage privé `documents/<user_id>/…`, une ligne `documents` est créée, un travail `document-ingest` est déposé.
2. **Comprendre** : le worker lit le document (texte ou vision), le découpe selon sa structure, rattache chaque passage à un chapitre de l'utilisateur, l'indexe (vecteur + texte intégral). La synthèse est générée une fois (`synthesis-generate`).
3. **S'entraîner** : une banque de questions est générée par module ou chapitre (`quiz-generate`). Les réponses attendues ne quittent jamais le serveur.
4. **Progresser** : la maîtrise par chapitre est recalculée après chaque quiz.

## Sécurité

- **Isolation** : RLS sur toutes les tables, clés étrangères composites `(id, user_id)`, fonctions de recherche filtrées sur `auth.uid()`. Vérifié par `tests/database-isolation.test.ts`.
- **Écritures serveur uniquement** pour ce qui est calculé ou facturé : passages, synthèses, quiz, maîtrise, essai, abonnements, consommation IA.
- **Fichiers** : bucket privé, dossier par utilisateur, types et taille limités.
- **Injection dans les documents** : le contenu des passages est échappé et présenté au modèle comme donnée.
- **En-têtes** : `nosniff`, `X-Frame-Options: DENY`, politique de référent stricte (dans `src/proxy.ts`).
- **Secrets** : uniquement dans les variables d'environnement serveur, validées au démarrage (`src/lib/env.ts`).

## IA

- Le produit appelle `AiProvider.complete()`, jamais un SDK directement.
- L'implémentation Claude active le cache de prompt, le repli automatique en cas de refus, un délai maximal et deux nouvelles tentatives.
- Deux niveaux de modèle configurables (`ATUMI_AI_MODEL`, `ATUMI_AI_MODEL_LIGHT`) pour réserver le plus coûteux aux tâches qui le demandent.
- Chaque appel renvoie sa consommation, à enregistrer dans `ai_usage` par utilisateur, pays et fonctionnalité.

## International

Le pays est un paramètre : `countries` et `education_levels` en base, `src/config/countries.ts` pour les moyens de paiement et formats. Ouvrir un pays = ajouter ses niveaux, ses prix et ses moyens de paiement, puis l'activer.

## Reste à construire pour le MVP

- Écrans d'inscription, d'import, de synthèse, de tuteur, de quiz et de progression.
- Lecture des documents dans le worker : PDF et Word (.docx) par extraction du texte, photos (JPG, PNG, WebP) par le modèle, qui demande de reprendre une photo floue ou coupée. Embeddings à venir.
- Génération et correction des quiz.
- Paiement Mobile Money et contrôle de l'essai.
- Recalcul de la maîtrise et tableau de bord.

## Appels avec le professeur IA (V1)

Demandé pour la V2 puis avancé en V1 par Idrissa (2026-11-06). Base posée : `tutor_calls`, `plans.call_minutes_limit`, `call_quota()`. Reste à choisir le service de voix (reconnaissance et synthèse vocales en temps réel) et à fixer les minutes par forfait.

- voix d'abord, vidéo en option : l'élève parle et entend Prof ATUMI, qui apparaît en avatar animé ; une vraie caméra côté élève n'est pas nécessaire et coûte cher en données mobiles ;
- mode dégradé automatique vers l'audio seul, puis le texte, quand la connexion faiblit ;
- même cerveau que le texte : la session vocale passe par `AiProvider` avec les mêmes règles (sources citées, solution seulement après une tentative, contestation sans débat), et la transcription est enregistrée comme les messages écrits ;
- langues : français et anglais d'abord ; le wolof à l'oral dépendra de la qualité de la reconnaissance et de la synthèse vocales disponibles ;
- minutes de visio comptées par forfait (comme les quiz, table `plans`), car c'est la fonction la plus coûteuse ; pas d'appel pendant l'essai gratuit (choix d'Idrissa) ;
- mineurs : pas d'enregistrement vidéo, audio conservé seulement sous forme de transcription, accord parental qui couvre explicitement cette fonction.

## Prévu pour la V2

- Annales et programmes constitués par ATUMI (décision V1 : l'apprenant fournit ses anciens examens).


## Limites de l'essai gratuit

Choix d'Idrissa (2026-11-06) : un essai « très limité » qui permet une boucle complète. Toutes les limites sont des données de la table `plans` (`null` = sans limite) et sont vérifiées par la base :

- 1 import (`document_limit`, déclencheur `before_document_insert`) ;
- 1 quiz (`quiz_limit`) de 5 questions (`quiz_question_limit`, à appliquer par le générateur de quiz) ;
- 3 messages de l'apprenant au professeur (`tutor_message_limit`, déclencheur `check_tutor_message_quota`) ;
- pas d'appel (`call_minutes_limit = 0`).

L'interface lit ce qu'il reste avec `plan_usage()`, `quiz_quota()` et `call_quota()`.
