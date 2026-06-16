# BRIEF-10 — Pyramide de tests du module enchères

## Objectif
Une stratégie de tests complète et pérenne pour le module enchères, au-delà de
la recette manuelle one-shot du BRIEF-07.

## Les 4 étages livrés
1. **Contrat unitaire** (existant) : `src/lib/auction-*.test.ts`, gate CI, sans DB.
2. **Couche route** (`tests/e2e/guards.e2e.ts`) : gardes de soumission via HTTP
   (auth 401, gardien nommé, 2 gardiens, doublon, deadline tolérance zéro,
   acceptation du dépassement de budget pénalisé au dépouillement).
3. **Bout en bout** (`tests/e2e/scenario.e2e.ts`) : enchère complète 4
   participants, 2 tours + fin de phase, vérifie les 5 cas du contrat et
   l'écriture des effectifs dans TEAM.
4. **Exploratoire** (`docs/recette-encheres-exploratoire.md`) : passe manuelle
   à l'aveugle du code avant chaque ouverture réelle (été, hiver).

## Outillage
- `tests/e2e/harness.ts` : auth next-auth + appels HTTP + reset/lecture DB.
  IDs joueurs LUS dans la fixture (robuste aux re-seeds).
- `vitest.e2e.config.ts` + `npm run test:e2e` : séparé de la gate unitaire
  (les `.e2e.ts` ne matchent pas le glob `.test.ts`, la gate reste sans DB).
- `tests/e2e/ci-setup.ts` : bootstrap des tables hors-schéma Prisma (AUCTION*,
  ADMIN_USER) + admin opérateur + AUCTION ouverte.
- `.github/workflows/e2e-encheres.yml` : MySQL de service + seed + app dev +
  `test:e2e`.

## État de vérification
- Étages 1-3 : **VERTS en local** (gate 364 tests ; E2E 14 tests) contre la
  base de recette.
- Étage CI : workflow écrit, **workflow_dispatch uniquement, PAS encore validé
  par un run GitHub réel** (non éprouvable en local). À passer en trigger
  `pull_request` après un premier run vert. `ci-setup.ts` validé en local
  (idempotent).

## Hors périmètre
Aucune modification du moteur ni du règlement. Le harnais OBSERVE.

## Vérification
`npm test` (gate, vert) + `npm run test:e2e` (E2E, vert) en local. Le job CI
nécessite un run `workflow_dispatch` pour être confirmé.
