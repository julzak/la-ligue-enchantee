# Tests E2E du module enchères

Pyramide de tests du module enchères. Pilote l'application RÉELLE par ses
endpoints HTTP, sur l'environnement de recette isolé. **Jamais la prod.**

## Les étages

| Étage | Où | Couvre | Tourne |
|---|---|---|---|
| 1. Contrat unitaire | `src/lib/auction-*.test.ts` (vitest) | règles pures du moteur, helpers | gate CI (`npm test`), sans DB |
| 2. Couche route | `tests/e2e/guards.e2e.ts` | gardes de soumission (auth, B1/B2/B3, deadline, dépassement) via HTTP | `npm run test:e2e` |
| 3. Bout en bout | `tests/e2e/scenario.e2e.ts` | enchère complète 2 tours + fin de phase + écriture TEAM | `npm run test:e2e` |
| 4. Exploratoire | `docs/recette-encheres-exploratoire.md` | ce que l'auto rate (UI, cas non anticipés), agent à l'aveugle | manuel, avant chaque ouverture réelle |

Les étages 2-3 ne tournent PAS dans `npm test` (la gate reste sans DB) : les
fichiers `.e2e.ts` ne matchent pas le glob `.test.ts`.

## Lancer en local

Pré-requis : Docker Desktop lancé.

```bash
# 1. Conteneur MySQL de recette (le créer si absent, cf audits/recette-encheres-env.md)
docker start ligue-recette-mysql

# 2. App en mode dev sur la base de recette (mode dev = pas de build/prerender)
DATABASE_URL="mysql://recette:recette2026@127.0.0.1:3310/ligueenc_recette" \
NEXTAUTH_SECRET="recette-secret-2026" NEXTAUTH_URL="http://localhost:3100" \
npx next dev -p 3100 &

# 3. Les tests (dans un autre terminal)
DATABASE_URL="mysql://recette:recette2026@127.0.0.1:3310/ligueenc_recette" \
E2E_BASE_URL="http://localhost:3100" RECETTE_PASSWORD="recette2026" \
npm run test:e2e
```

Le harnais remet l'enchère à l'état vierge (`resetAuction`) au début de chaque
fichier : rejouable à volonté. Les IDs de joueurs sont LUS dans la fixture
(pas codés en dur).

## En CI

`.github/workflows/e2e-encheres.yml` (MySQL de service + seed + `ci-setup.ts`
+ app dev + `test:e2e`). **workflow_dispatch uniquement** tant qu'un premier
run vert sur GitHub ne l'a pas validé : le passer en `pull_request` ensuite
pour le rendre bloquant. Voir le commentaire en tête du workflow.

## Reproduire la fixture de zéro

```bash
DATABASE_URL=... ./node_modules/.bin/prisma db push --skip-generate --accept-data-loss
DATABASE_URL=... ./node_modules/.bin/tsx scripts/seed-recette-encheres.ts --apply
DATABASE_URL=... ./node_modules/.bin/tsx scripts/seed-gardiens-club.ts --apply
DATABASE_URL=... ./node_modules/.bin/tsx tests/e2e/ci-setup.ts
```
