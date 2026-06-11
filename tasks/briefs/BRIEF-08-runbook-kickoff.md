# BRIEF-08 — La phase enchères dans le kick-off de saison

## Objectif
L'admin qui lance une nouvelle saison voit les enchères comme étape du parcours de kick-off (création → effectifs → ligues/participants → enchères → équipes constituées), à la place de l'encart « module à venir ».

## Contexte
- Vision tracée dans tasks/todo.md : le kick-off intègre les enchères comme étape finale.
- Pages : `src/app/admin/kickoff` (sert `docs/kickoff-nouvelle-saison.md`), `src/app/admin/nouvelle-saison` (SeasonManager), `src/app/admin/encheres`.
- Attention deploy : `docs/**` déploie (le guide kickoff est servi à la requête).

## Critères d'acceptation
- [ ] Le guide kick-off (`docs/kickoff-nouvelle-saison.md`) documente la phase enchères : ouverture, rythme des tours, clôture, dépouillement, complétion d'office, pont TEAM, et l'envoi manuel des récaps par les modérateurs.
- [ ] L'encart « module à venir » a disparu ; à sa place, un lien fonctionnel vers `/admin/encheres` au bon moment du parcours.
- [ ] Un admin qui suit le guide de bout en bout n'a besoin d'aucune connaissance hors plateforme (le runbook se suffit).

## Hors périmètre
Toute logique d'enchères. Toute refonte du parcours nouvelle-saison au-delà de l'insertion de l'étape.

## Dépendances
BRIEF-07 (le runbook décrit un module recetté, pas un module espéré).

## Budget et conditions d'arrêt
- ~3 fichiers : le guide markdown, la page kickoff/nouvelle-saison pour l'encart, éventuel lien.
- Arrêt SUCCÈS : critères verts, build local vert, PR ouverte.
- Arrêt SUSPENSION : incohérence entre le guide et le comportement réel constaté → PLAN.md ## Blocages (le guide ne documente jamais un comportement non vérifié).

## Vérification
Relecture du guide en suivant chaque étape sur l'environnement local.

## Questions ouvertes
(aucune)
