# Recette wizard nouvelle saison + Mouvements — 2026-08-01

Environnement : recette locale isolée (MySQL Docker `ligue-recette-mysql`, app :3100, code = main `2893e28`, celui déployé en prod le matin même). Testeur : agent frais avec brief seul. Prod jamais touchée.

## Verdict

**GO** : les 4 fonctionnalités livrées (reprise du wizard à la bonne étape, boutons retour 5→4→3→2 avec rechargement des données, avertissement avant recréation des ligues, filtre Mouvements) sont conformes. Un bug hors périmètre trouvé en passant, corrigé dans la foulée (PR séparée).

## Ce qui fonctionne (9 scénarios PASS, captures 01-14)

- Reprise directe à l'étape 4 (clubs + ligues en base), à l'étape 3 (0 ligue), à l'étape 2 (0 club), à l'étape 5 (enchères ouvertes).
- Retours 5→4, 5→2, 4→3, 3→2 : ligues rechargées dans le formulaire, participants rechargés, avertissement ambre présent quand les ligues existent.
- Scénario destructif vérifié en réel : recréer les ligues remplace les divisions et vide `LEAGUE_USER` (comportement documenté par l'avertissement).
- Action interdite en AUCTION : 409 « Ligues modifiables uniquement en statut SETUP » affiché en bandeau rouge lisible, pas de charabia JSON.parse.
- Mouvements : divisions de la saison clôturée absentes, divisions actives présentes (ligues legacy sans saison tolérées).

## Bugs

- **Corrigé (PR fix/seasons-fetch-error)** : échec du `GET /api/admin/seasons` avalé → faux état « Aucune saison. Crée la première ci-dessous », risque de recréation d'une saison existante. Reproduit naturellement une fois pendant le run. Repro scriptée : `s9-fetch-echec-etat-vide.js`.

## Frictions UX (non bloquantes, non traitées)

1. Étape 3 via retour : « Ligues créées. » affiché en permanence, y compris à côté du bandeau d'erreur 409 (signaux contradictoires).
2. En AUCTION, le bouton « Créer les ligues » reste cliquable alors que l'action est toujours refusée (409) : pourrait être désactivé avec le motif.
3. Login recette parfois flaky en headless (probable clic avant hydration), sans feedback d'échec visible.

## Notes de méthode

- L'agent a lu `plan-de-test.md` de l'orchestrateur pendant sa reconnaissance (fichier laissé dans le dossier d'audit) : l'isolation était partielle. Couverture identique au plan + 1 scénario original (S9, celui qui a trouvé le bug). Leçon : écrire le plan orchestrateur HORS du dossier visible par l'agent.

## Données de test

- Saisons `TEST-*` de la base recette : supprimées (`seed-state.sh cleanup`), base rendue à son état fixture enchères. Saison `2026-2027` et ligue « Ligue Recette Enchères » intouchées (vérifié).
- App :3100 arrêtée. Conteneur `ligue-recette-mysql` laissé up (état d'origine).
- Artefacts conservés : 17 captures PNG, 8 scripts JS de repro, `seed-state.sh`, `plan-de-test.md`.
