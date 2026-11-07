# LULU

Plateforme d'apprentissage par IA : l'apprenant importe ses cours, obtient une synthèse, travaille avec un professeur IA qui cite ses pages, s'entraîne avec des quiz et voit ses lacunes par module ou chapitre.

Lancement au Sénégal, application conçue pour s'ouvrir à d'autres pays par simple configuration.

## Stack

| Brique | Choix |
| --- | --- |
| Application | Next.js 16 + TypeScript, en PWA installable |
| Base de données, authentification, fichiers | Supabase (PostgreSQL, pgvector, RLS, stockage privé) |
| Traitements lourds | File de tâches pg-boss sur PostgreSQL, worker séparé |
| IA | Claude via l'interface interne `AiProvider` |
| Tests | Vitest, avec un Postgres embarqué (PGlite) pour les tests d'isolation |

## Démarrer en local

```bash
npm install
cp .env.example .env.local   # puis remplir les valeurs
npm run dev                  # application sur http://localhost:3000
npm run worker               # dans un second terminal
```

La migration `supabase/migrations/20261105000000_init.sql` s'applique avec la CLI Supabase (`supabase db push`) ou depuis l'éditeur SQL du projet.

## Vérifications

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Organisation du code

```
src/
  app/                 pages, manifeste PWA, routes API
  config/countries.ts  pays, indicatifs, devises, moyens de paiement
  i18n/messages.ts     tous les textes de l'interface
  lib/supabase/        clients Supabase (utilisateur, service, navigateur)
  proxy.ts             rafraîchissement de session et en-têtes de sécurité
  server/ai/           interface fournisseur, implémentation Claude, consignes, tuteur
  server/learning/     règles pédagogiques (tentative avant solution, essai, maîtrise)
  server/jobs/         files de tâches et dépôt de travaux
  worker/              processus worker
supabase/migrations/   schéma, RLS, fonctions de recherche, données de départ
tests/                 tests unitaires et tests d'isolation de la base
```

Les règles produit et techniques à respecter sont détaillées dans [AGENTS.md](AGENTS.md) et [docs/architecture.md](docs/architecture.md).
