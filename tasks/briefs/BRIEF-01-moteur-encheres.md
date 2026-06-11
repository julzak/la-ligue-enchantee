# BRIEF-01 — Tests du moteur dans la gate CI

## Objectif
Les 7 tests du contrat protègent le moteur d'enchères à chaque PR, pas seulement quand quelqu'un pense à les lancer.

## Contexte
- Le moteur pur EXISTE : `src/lib/auction-engine.ts` (commit c52f685 du 2026-06-10, E0+E1) : attribution, égalités, restitution, pénalités/retraits, complétion d'office. Les 7 tests du contrat existent en scripts tsx (`scripts/test-encheres-*.ts`, helpers dans `scripts/lib/test-encheres-helpers.ts`) et passent (vérifié le 2026-06-11).
- Problème : la gate CI (`.github/workflows/ci.yml`) lance `npm test` = vitest, qui ne voit pas ces scripts. Un chantier qui casse le moteur passerait la CI.
- Source de vérité des règles : `docs/regles-encheres.md`. Ne PAS modifier la logique du moteur dans ce chantier.

## Critères d'acceptation
- [ ] Les 7 cas du contrat tournent sous vitest (donc dans `npm test` et la CI), chacun avec son sanity-check conservé.
- [ ] Pas de double maintenance : une seule source pour chaque cas de test (porter les scripts en `src/lib/auction-engine.test.ts` et réduire les scripts tsx à de simples wrappers, ou les supprimer si CLAUDE.md est mis à jour en conséquence).
- [ ] La section « contrat de tests » de CLAUDE.md reflète le nouvel emplacement.
- [ ] Une régression volontaire introduite localement dans le moteur (puis annulée) fait échouer `npm test` : preuve que la gate protège.

## Hors périmètre
Toute modification de la logique du moteur. Les routes API. Le branchement DB (BRIEF-05).

## Dépendances
Aucune.

## Budget et conditions d'arrêt
- ~4 fichiers : le fichier de test vitest, les scripts existants (réduits ou supprimés), CLAUDE.md.
- Arrêt SUCCÈS : `npm test` vert avec les 7 cas inclus, preuve de détection de régression faite, PR ouverte.
- Arrêt SUSPENSION : si un test révèle un écart entre moteur et règlement, NE PAS corriger le moteur : tracer dans PLAN.md ## Blocages.

## Vérification
`npm test` en local et CI verte sur la PR. Le test de régression volontaire documenté dans la PR.

## Questions ouvertes
(aucune)
