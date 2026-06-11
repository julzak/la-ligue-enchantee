# BRIEF-07 — Recette simulée (échéance : 30 juin 2026)

## Objectif
Prouver que le module tient en conditions réelles AVANT les enchères d'août : une simulation complète avec participants fictifs, où chaque divergence entre le résultat attendu (calculé à la main) et le résultat produit est loguée.

## Contexte
- Exigée par CLAUDE.md (« recette fonctionnelle ») et par tasks/todo.md (E7). C'est la couche au-dessus des tests unitaires : elle exerce l'enchaînement réel UI → API → moteur → DB → TEAM.
- Utiliser le skill ship-review (phase E2E, agents frais : le testeur reçoit ce brief et `docs/regles-encheres.md`, PAS le code) sur un environnement local seedé. JAMAIS sur la base de prod.
- Construire le scénario pour couvrir les cas limites du contrat : une égalité, une mise sans gardien, un excès d'attaquants, un dépassement de budget, un participant en sous-nombre complété d'office.

## Critères d'acceptation
- [ ] 3 à 5 participants fictifs jouent 2 tours complets (mise → clôture → dépouillement → résultats) via l'UI, pas par insertion SQL directe.
- [ ] Le scénario contient au moins : 1 égalité de mise, 1 pénalité de gardien manquant, 1 excès de ligne, 1 dépassement de budget, 1 complétion d'office en fin de phase.
- [ ] Pour chaque tour, le résultat attendu est calculé à la main AVANT le dépouillement et committé dans le rapport ; toute divergence est loguée avec sa cause.
- [ ] À la fin, les effectifs sont dans TEAM et un calcul de scoring de test tourne.
- [ ] Rapport de recette dans `audits/<date>-recette-encheres/` : verdict GO/NO-GO, divergences, captures.

## Hors périmètre
Aucune correction de fond pendant la recette : les bugs trouvés deviennent des entrées dans PLAN.md ## Blocages ou des chantiers correctifs. La recette observe et documente.

## Dépendances
BRIEF-02, BRIEF-04, BRIEF-05, BRIEF-06 mergés.

## Budget et conditions d'arrêt
- ~3 livrables : seed de simulation, scripts E2E jetables dans audits/, rapport.
- Arrêt SUCCÈS : rapport rendu avec verdict, zéro divergence non expliquée.
- Arrêt SUSPENSION : un bug bloquant empêche de finir un tour → rapport partiel + blocage tracé.

## Vérification
Le rapport lui-même, relu par Julien (walkthrough produit). Le verdict GO conditionne l'ouverture des enchères réelles.

## Questions ouvertes
(aucune)
