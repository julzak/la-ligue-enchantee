# BRIEF-01 — Moteur d'enchères pur

## Objectif
Toute la logique de dépouillement du règlement dans une lib pure, testée, sans dépendance DB : c'est elle qui rendra le dépouillement automatisé digne de confiance.

## Contexte
- Source de vérité : `docs/regles-encheres.md` §3.2 (attribution, restitution, pénalités) et §4 (complétion d'office). Le code suit le règlement, jamais l'inverse.
- Le résolveur actuel vit dans `/api/admin/auction` (resolve-round) : plus haute mise gagne, égalité = statut tie. Il sera branché sur ce moteur au BRIEF-05 ; ce chantier-ci ne touche PAS aux routes.
- Modèle existant : tables AUCTION, AUCTION_BID (round, statuts pending/won/lost/tie). Le moteur prend des structures en mémoire, pas des rows Prisma.
- Contrat de tests : CLAUDE.md liste 7 cas `scripts/test-encheres-*.ts`. Décision de ce brief : les implémenter en **vitest** (`src/lib/auction-engine.test.ts`, un describe par cas du contrat) pour qu'ils tournent dans la gate CI, et mettre à jour la section correspondante de CLAUDE.md. L'intention (les 7 cas + sanity-checks) est inchangée.

## Critères d'acceptation
- [ ] Une fonction de dépouillement prend les mises d'un tour et rend : acquisitions par participant, joueurs remis en jeu (égalités), points restitués, retraits de pénalité avec motif lisible par un humain, budget restant par participant.
- [ ] Les 7 cas du contrat passent : égalité → personne et points rendus ; mise sans gardien → retrait de 1 joueur (la plus grosse acquisition) ; 131 pts → retrait de 1 joueur ; 5 attaquants obtenus → retrait du plus cher ; report des points non dépensés au tour suivant ; pénalité de 2 retraits avec 1 seule acquisition → 1 retrait, pas de dette ; soumission 1 s après la deadline → rejetée.
- [ ] Règles de sélection du retrait respectées : plus grosse mise, ordre alphabétique (nom de famille) en cas d'égalité, par ligne pour les excès de ligne.
- [ ] Complétion d'office (règle 4) : une fonction prend les effectifs incomplets et une liste de joueurs disponibles et rend les ajouts à 1 pt.
- [ ] Chaque test inclut un sanity-check prouvant qu'il détecterait la régression qu'il garde.

## Hors périmètre
Aucune route API, aucune page, aucune table, aucune migration. Pas de logique gardien-par-club (BRIEF-03) au-delà du quota « exactement 1 gardien ».

## Dépendances
Aucune.

## Budget et conditions d'arrêt
- ~3 fichiers : `src/lib/auction-engine.ts`, `src/lib/auction-engine.test.ts`, CLAUDE.md (section contrat).
- Arrêt SUCCÈS : `npm test` vert (21 tests existants + les nouveaux), typecheck vert, PR ouverte.
- Arrêt SUSPENSION : une règle du règlement est ambiguë → l'écrire dans PLAN.md ## Blocages avec le cas concret chiffré, passer au chantier suivant.

## Vérification
`npm test` en local et en CI. Revue du motif de chaque retrait sur un cas multi-pénalités construit à la main.

## Questions ouvertes
(aucune)
