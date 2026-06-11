# Pipeline boucle autonome — convention

Comment une idée devient du code mergé sans intervention humaine entre le cadrage et la revue produit. Lu par les agents d'exécution à chaque itération.

## Fichiers et rôles

| Fichier | Rôle | Qui écrit |
|---|---|---|
| `VISION.md` | Le pourquoi du module, stable | Idéation (skill /ideation) |
| `PLAN.md` | Chantiers, séquence, dépendances, sections `## État` et `## Blocages` | Idéation, puis agents (état) |
| `tasks/briefs/BRIEF-<nn>-<slug>.md` | Spec d'un chantier (template : `tasks/briefs/BRIEF-template.md`) | Idéation, enrichi par les réponses aux questions |
| `tasks/pipeline.md` | Ce fichier | Humain |

## Règles de la boucle d'exécution

1. Lire `PLAN.md ## État`, prendre le premier chantier `à faire` dont les dépendances sont `mergé`.
2. Travailler sur une branche `chantier/<nn>-<slug>`. **JAMAIS de push sur main** : main auto-déploie la production (un hook global le bloque de toute façon).
3. Implémenter selon le brief, dans son budget. Toute ambiguïté : l'écrire dans `PLAN.md ## Blocages`, marquer le chantier `bloqué`, passer au suivant. Ne jamais interpréter silencieusement.
4. Vérifier : `npm run lint && npm test && npm run build` en local, puis lancer le skill ship-review (review par agents frais + E2E sur les critères d'acceptation du brief).
5. Ouvrir une PR vers main avec le brief en description. Attendre la CI. CI rouge : corriger et boucler jusqu'au vert.
6. Marquer le chantier `en review` dans `PLAN.md ## État`. **Le merge est réservé à Julien** (merge = déploiement production immédiat).
7. Après merge : Julien ou l'agent marque `mergé`, la boucle prend le chantier suivant.

## Garde-fous (non négociables)

- Aucun droit au-delà de la PR : pas de merge, pas de touche au workflow deploy.yml, pas de migration SQL exécutée (les migrations restent un acte manuel gaté, cf. `sql/`).
- Pas de nouvelle dépendance sans la justifier dans la PR.
- Les retours produit de Julien arrivent comme nouveaux briefs ou commentaires de PR, jamais comme instructions orales perdues.
