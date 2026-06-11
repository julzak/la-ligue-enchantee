# PLAN — Module Enchères d'été (pilote boucle autonome)

Voir `VISION.md` (le pourquoi), `docs/regles-encheres.md` (source de vérité des règles, amendements en section 7), `tasks/pipeline.md` (règles de la boucle d'exécution). Un brief par chantier dans `tasks/briefs/`.

## Chantiers et dépendances

| Brief | Contenu | Dépend de |
|---|---|---|
| BRIEF-01-moteur-encheres | Porter les 7 tests du contrat dans la gate CI (vitest). Le moteur pur existe déjà : `src/lib/auction-engine.ts`, commit c52f685 du 2026-06-10 | rien |
| BRIEF-02-deadline-cloture | Heure butoir optionnelle par tour, rejet serveur tolérance 0, compte à rebours UI | rien |
| BRIEF-03-gardiens-par-club | Pseudo-joueurs « Gardiens [Club] », exclusion des vrais gardiens des mises, note = gardien aligné | rien |
| BRIEF-04-soumission-conforme | Mise à 13 joueurs avec acquis pré-remplis, exclusion des joueurs attribués, avertissements de quotas | 03 |
| BRIEF-05-depouillement-pont-team | Dépouillement branché sur le moteur (existant), retraits motivés persistés, pont TEAM fin de phase, complétion d'office, suppression du tirage au sort | 03 |
| BRIEF-06-resultats | Page résultats par tour (participant) + récap copiable (admin, pour l'email manuel) | 05 |
| BRIEF-07-recette-simulee | Simulation 3-5 participants fictifs, 2 tours complets, divergences loguées (échéance : 30 juin) | 02, 04, 05, 06 |
| BRIEF-08-runbook-kickoff | La phase enchères intégrée au guide kick-off admin | 07 |

Parallélisme possible : 01, 02 et 03 sont indépendants. 04 et 05 peuvent avancer en parallèle après leurs dépendances.

## Décisions tranchées (ne pas re-litiger, détail dans regles-encheres.md §7)

- Gardien = pseudo-joueur « Gardiens [Club] », note du gardien aligné par le club.
- Clôture d'un tour = action admin ; butoir optionnel, mais s'il est renseigné : tolérance 0.
- Égalité de mise = personne n'obtient le joueur ; aucun tirage au sort (code existant à retirer).
- Résultats : plateforme + email MANUEL par les modérateurs (récap copiable). Pas d'infra email.
- Migrations SQL : jamais exécutées par un agent. Le chantier livre le fichier dans `sql/`, Julien l'applique avant de merger.

## Échéances

- Recette simulée (BRIEF-07) : **30 juin 2026 au plus tard**.
- Enchères réelles : début août 2026. Prérequis hors boucle : import des effectifs réels début juillet (football-data.org, avatars à initiales, cf tasks/todo.md).

## État

- BRIEF-01-moteur-encheres — mergé (PR #4, 2026-06-11)
- BRIEF-02-deadline-cloture — mergé (PR #5, 2026-06-11 ; migration round_deadline appliquée en prod)
- BRIEF-03-gardiens-par-club — mergé (PR #6, 2026-06-11 ; seed reporté au kick-off de juillet, garde-fou en place)
- BRIEF-04-soumission-conforme — mergé (PR #8, 2026-06-11 ; smoke E2E + review design passés)
- BRIEF-05-depouillement-pont-team — mergé (PR #9, 2026-06-11 ; migration AUCTION_REMOVAL + ENUM→VARCHAR appliquée en prod)
- BRIEF-06-resultats — en review (PR #11, 2026-06-11 ; findings N5/N6 traités, récap copiable admin, onglet résultats participant, 18 tests vitest)
- BRIEF-07-recette-simulee — à faire (environnement prêt : audits/recette-encheres-env.md, conteneur ligue-recette-mysql port 3310, comptes recette2026)
- BRIEF-08-runbook-kickoff — à faire (inclure : ordre saison → clubs → joueurs → seed gardiens → enchères ; procédure de réparation close-phase ; DDL ADMIN_USER/SCORING_CONFIG à régulariser dans sql/)

## Blocages

(aucun)
