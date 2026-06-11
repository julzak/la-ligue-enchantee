# BRIEF-<nn> — <titre du chantier>

## Objectif
Une phrase : ce que ce chantier rend possible pour l'utilisateur final.

## Contexte
Ce que l'agent doit savoir avant de toucher au code : fichiers et modules concernés, décisions déjà tranchées (ne pas re-litiger), pièges connus du repo.

## Critères d'acceptation (testables en parcours utilisateur)
- [ ] L'utilisateur peut <action> et voit <résultat observable>.
- [ ] <cas d'erreur> est bloqué et l'utilisateur voit <message>.
(Chaque critère doit être vérifiable par un agent E2E qui n'a que ce brief et l'URL.)

## Hors périmètre
Ce que le chantier ne doit PAS toucher (fichiers, features, comportements existants).

## Dépendances
Briefs qui doivent être mergés avant celui-ci. Données ou accès nécessaires.

## Budget et conditions d'arrêt
- Périmètre attendu : ~N fichiers, zone <dossier>.
- Arrêt SUCCÈS : tous les critères verts (CI + E2E) et PR ouverte.
- Arrêt SUSPENSION : ambiguïté bloquante (l'écrire dans PLAN.md ## Blocages et passer au chantier suivant), dépendance manquante, ou budget dépassé de moitié sans critère vert.

## Vérification
Comment prouver que ça marche : commande de test, scénario E2E à jouer, environnement cible.

## Questions ouvertes
À lever avant ou pendant le chantier. Une question levée = réponse recopiée ici, datée.
