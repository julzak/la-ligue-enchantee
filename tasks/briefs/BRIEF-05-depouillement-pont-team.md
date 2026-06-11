# BRIEF-05 — Dépouillement branché sur le moteur et pont vers les équipes

## Objectif
L'admin clôture un tour et le dépouillement applique le règlement via le moteur existant ; à la fin de la phase, les effectifs sont écrits dans TEAM : sans ce pont, pas d'équipes et pas de scoring.

## Contexte
- Resolveur actuel dans `/api/admin/auction` (resolve-round, resolve-tiebreak, close-auction). resolve-tiebreak (tirage au sort) doit DISPARAÎTRE : décision tracée du 2026-06-10, l'aléatoire n'a jamais été au règlement.
- Le moteur pur existant (`src/lib/auction-engine.ts`, commit c52f685 du 2026-06-10) rend acquisitions, restitutions, retraits motivés, complétion d'office. Ce chantier le branche sur la DB (AUCTION_BID statuts won/lost/tie) et persiste les retraits AVEC leur motif (nouvelle structure si besoin, migration via `sql/`, appliquée par Julien avant merge).
- Pont TEAM : seuls les jokers écrivent dans TEAM aujourd'hui. S'inspirer de ce chemin d'écriture existant.
- Fin de phase (règle 4) : quand tous les participants ont 13 joueurs valides, ou complétion d'office à 1 pt par l'admin.

## Critères d'acceptation
- [ ] « Clôturer le tour » puis « Dépouiller » (admin) applique le moteur : attributions, égalités remises en jeu, restitutions, retraits motivés, budgets recalculés. Aucun calcul de règle dans la route : tout vient du moteur.
- [ ] Chaque retrait est persisté avec son motif (ex : « 5 attaquants misés : retrait de Mbappé, acquisition la plus chère de la ligne ») et consultable ensuite (BRIEF-06 l'affichera).
- [ ] Le bouton/chemin « tirage au sort » n'existe plus, ni en UI ni en API.
- [ ] « Clore la phase » : si un participant a moins de 13 joueurs, l'admin voit la liste et déclenche la complétion d'office à 1 pt (joueurs disponibles proposés) ; puis les 13 joueurs de chaque participant sont écrits dans TEAM pour la saison.
- [ ] Après le pont, les équipes apparaissent là où les équipes vivent déjà (même chemin que les effectifs actuels), et un tour de scoring de test tourne sans erreur.

## Hors périmètre
La page de résultats participant (BRIEF-06). L'UI de mise. Les notifications.

## Dépendances
BRIEF-03 (pseudo-gardiens dans les effectifs écrits). Le moteur existe déjà ; BRIEF-01 (tests dans la gate CI) est fortement recommandé avant, pour que la CI protège ce branchement.

## Budget et conditions d'arrêt
- ~8 fichiers : `/api/admin/auction`, page admin enchères, persistance des retraits (schema + sql/), pont TEAM, tests d'intégration du branchement.
- Arrêt SUCCÈS : critères verts, build local vert, PR ouverte signalant la migration éventuelle à appliquer avant merge.
- Arrêt SUSPENSION : si le chemin d'écriture TEAM des jokers ne se généralise pas proprement (contraintes saison/journée), documenter le conflit dans PLAN.md ## Blocages, ne pas forcer.

## Vérification
Test d'intégration : 3 participants fictifs, 1 tour complet en DB locale, résultats comparés à un calcul à la main. Vérifier qu'un UPDATE des won/lost correspond exactement à la sortie du moteur.

## Questions ouvertes
(aucune)
