# BRIEF-03 — Gardiens par club

## Objectif
Les participants misent sur « Gardiens [Club] » et non sur un gardien nommé : si le titulaire est absent, le remplaçant aligné rapporte les points (règle 2.1).

## Contexte
- Décision archi tracée (`docs/regles-encheres.md` §7, 2026-06-10) : pseudo-joueur « Gardiens [Club] », 1 par club de Ligue 1, position Gardien. Mises, effectifs et compositions pointent ce pseudo-joueur ; sa note de journée est celle du gardien réellement aligné par le club. Aucune refonte du pipeline de scoring.
- Aujourd'hui les mises sont par player_id, vrais gardiens inclus (piège n°1 du CLAUDE.md).
- Les joueurs actuels sont des MOCK ; l'import des effectifs réels est hors boucle. Le chantier doit marcher sur les données mock et survivre à l'import (clé stable type `gardiens_marseille`).
- Données : livrer la création des pseudo-joueurs en `sql/` (appliquée par Julien avant merge) ou en script seed idempotent, au choix le plus sûr vu le schéma.

## Critères d'acceptation
- [ ] La recherche de joueurs libres sur la page de mise propose « Gardiens [Club] » (30 entrées) et ne propose AUCUN gardien nommé.
- [ ] Une mise sur un pseudo-gardien compte comme le gardien de l'effectif (quota « exactement 1 gardien »).
- [ ] Au calcul des points d'une journée, le pseudo-joueur reçoit la note du gardien aligné par son club (et 0/aucune note si aucune note de gardien ce jour-là, comportement identique aux joueurs sans note).
- [ ] Les vrais gardiens restent visibles dans l'explorateur (hors flux de mise) ; rien ne casse côté compositions existantes.

## Hors périmètre
L'import des effectifs réels. L'UI de mise au-delà de la liste des joueurs proposables (BRIEF-04). Le mercato d'hiver.

## Dépendances
Aucune.

## Budget et conditions d'arrêt
- ~6 fichiers : seed/sql, lib scoring (résolution de la note), `/api/admin/jokers/free` ou équivalent, tests.
- Arrêt SUCCÈS : critères verts avec un test vitest sur la résolution de note (gardien titulaire absent → note du remplaçant), build local vert, PR ouverte.
- Arrêt SUSPENSION : si la résolution « gardien aligné du club » est impossible avec les données de notes existantes, documenter précisément ce qui manque dans PLAN.md ## Blocages et s'arrêter (ne pas inventer de fallback silencieux).

## Vérification
Test vitest de la résolution de note sur données construites. Vérification manuelle de la liste de mise (30 pseudo-gardiens, 0 gardien nommé).

## Questions ouvertes
(aucune)
