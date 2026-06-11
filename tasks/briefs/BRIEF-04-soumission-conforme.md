# BRIEF-04 — Soumission conforme au règlement

## Objectif
Le participant soumet une mise de 13 joueurs dans les règles, voit ses acquis reportés automatiquement, ne peut pas miser sur un joueur déjà attribué, et est prévenu AVANT la deadline si sa mise encourt une pénalité.

## Contexte
- Règle 3.1 : la mise porte sur 13 joueurs, les acquis des tours précédents sont reportés automatiquement sans nouvelle mise ; total ≤ 130 points (budget restant en réalité, cf restitution 3.2.b).
- Écarts actuels (`tasks/todo.md` état des lieux) : on peut miser sur un joueur déjà won par un autre ; l'UI ne pré-remplit pas les acquis ; aucun avertissement de quota.
- Page de mise : `src/app/ligue/[slug]/encheres` ; recherche joueurs libres via `/api/admin/jokers/free` ; mise via `/api/auction` POST (remplacement par tour).
- Philosophie des avertissements : l'UI PRÉVIENT (gardien manquant, quotas de ligne, ≠13 joueurs, dépassement budget) mais ne BLOQUE pas la soumission : la pénalité reste appliquée au dépouillement si le participant ignore l'avertissement (le règlement pénalise, il n'interdit pas).

## Critères d'acceptation
- [ ] Le participant voit ses acquis pré-remplis et non retirables de sa mise, avec leur prix d'acquisition, et complète librement jusqu'à 13.
- [ ] Un joueur attribué à un autre participant n'apparaît plus dans la recherche et une mise dessus est rejetée côté serveur.
- [ ] Le budget affiché = budget restant réel (130 moins les acquisitions, restitutions comprises) et se décompte à la saisie.
- [ ] Si la mise viole une règle (pas de gardien, >6 DEF, >6 MIL, >4 ATT, ≠13 joueurs, total > budget), le participant voit un avertissement explicite citant la pénalité encourue, mais peut soumettre quand même.
- [ ] La soumission rejoue les contrôles côté serveur (le client n'est jamais la seule barrière) et enregistre la mise en remplacement de la précédente du même tour.

## Hors périmètre
Le dépouillement et l'application effective des pénalités (BRIEF-05). Le compte à rebours (BRIEF-02). La liste des pseudo-gardiens (BRIEF-03, prérequis).

## Dépendances
BRIEF-03 (les gardiens proposables sont les pseudo-joueurs).

## Budget et conditions d'arrêt
- ~6 fichiers : page de mise + composants, `/api/auction`, l'endpoint de joueurs libres, tests serveur.
- Arrêt SUCCÈS : critères verts (dont test serveur du rejet « joueur déjà attribué »), build local vert, PR ouverte.
- Arrêt SUSPENSION : ambiguïté de règle → PLAN.md ## Blocages avec le cas chiffré.

## Vérification
Tests vitest sur les contrôles serveur. Parcours manuel : acquérir un joueur (via un dépouillement simulé en DB locale), revenir au tour suivant, vérifier le pré-rempli et l'exclusion.

## Questions ouvertes
(aucune)
