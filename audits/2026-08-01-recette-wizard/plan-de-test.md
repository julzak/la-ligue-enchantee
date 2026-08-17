# Plan de test orchestrateur — wizard nouvelle saison + Mouvements (2026-08-01)

Environnement : recette locale (MySQL docker `ligue-recette-mysql`, app :3100, code = main `2893e28`).
Ce plan n'est PAS montré à l'agent testeur (il écrit ses propres scénarios ; comparaison en fin de run).

## États seedés (script seed-state.sh)

- Saison A `TEST-CLOSED-2025` : CLOSED, 2 ligues "TEST Division Fermée 1/2" avec participants.
- Saison B `TEST-SETUP-2027` : 2 clubs + 6 joueurs, 3 ligues "TEST Ligue A/B/C", participants 1461/1462/1463.
- Saison C `TEST-SETUP-SANSLIGUE` : 1 club, 0 ligue.
- Saison D `TEST-SETUP-VIDE` : 0 club.
- Saison recette #1 `2026-2027` AUCTION IS_CURRENT=1 : intouchée (exclue de la reprise car courante).
- États : `etape4` (B=SETUP, C/D=CLOSED), `etape3` (C=SETUP, B/D=CLOSED), `etape5` (B=AUCTION, C/D=CLOSED), `etape2` (D=SETUP, B/C=CLOSED).

## Scénarios attendus

| # | État | Action | Attendu |
|---|---|---|---|
| 1 | etape4 | Ouvrir /admin/nouvelle-saison | Reprise directe étape 4, 3 ligues TEST A/B/C affichées avec leurs participants |
| 2 | etape4 | Bouton "← Étape 3 (ligues)" | Étape 3, formulaire pré-rempli avec les 3 ligues, avertissement ambre visible, "Ligues créées." affiché |
| 3 | etape4→3 | Bouton "← Étape 2 (clubs & joueurs)" | Étape 2 |
| 4 | etape3 | Ouvrir la page | Reprise étape 3, formulaire vide (0 ligue), pas d'avertissement |
| 5 | etape2 | Ouvrir la page | Reprise étape 2 |
| 6 | etape5 | Ouvrir la page | Reprise étape 5, deux boutons retour : "← Étape 4 (participants)" et "← Étape 2" |
| 7 | etape5 | "← Étape 4 (participants)" | Étape 4 avec participants de B rechargés |
| 8 | etape4 | À l'étape 3 (via retour), recliquer "Créer les ligues" | Ligues remplacées, retour étape 4 : participants VIDES (comportement documenté par l'avertissement) |
| 9 | etape4 | /admin/promotions | TEST Ligue A/B/C visibles, "TEST Division Fermée" ABSENTES, "Ligue Recette Enchères" visible. Ligues legacy ID_SEASON NULL tolérées si participants |
| 10 | etape5 | À l'étape 3, "Créer les ligues" (statut AUCTION) | Erreur JSON lisible (409 "Ligues modifiables uniquement en statut SETUP"), pas de charabia JSON.parse |

## Sécurité

- Prod jamais touchée. Saison recette #1 et ligue #24 jamais modifiées.
- Cleanup : suppression des saisons TEST-* et de leurs ligues/clubs/joueurs/inscriptions en fin de run.
