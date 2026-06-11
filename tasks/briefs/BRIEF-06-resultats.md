# BRIEF-06 — Résultats par tour

## Objectif
Après le dépouillement, chaque participant consulte ses résultats sur la plateforme, et l'admin dispose d'un récap copiable pour envoyer l'email manuellement (amendement du 2026-06-11 : pas d'email automatique).

## Contexte
- Règle 3.2.d amendée (`docs/regles-encheres.md` §7) : résultats consultables sur la plateforme ; l'email est envoyé MANUELLEMENT par les administrateurs/modérateurs à partir du récap fourni.
- Les données viennent de BRIEF-05 : acquisitions, budget restant, retraits avec motifs, joueurs remis en jeu.
- Pages existantes : `src/app/ligue/[slug]/encheres` (participant), `src/app/admin/encheres` (admin).

## Critères d'acceptation
- [ ] Le participant voit, pour chaque tour dépouillé : ses acquisitions (joueur, prix), ses mises perdues (avec la raison : surenchéri ou égalité), ses retraits de pénalité avec motif, et son budget restant pour le tour suivant.
- [ ] Le participant ne voit PAS les mises des autres tant que le tour n'est pas dépouillé (enchères fermées) ; après dépouillement, il voit qui a obtenu quels joueurs et à quel prix (transparence du dépouillement).
- [ ] L'admin voit un récap global du tour par participant et peut le copier en un clic (texte brut propre, prêt à coller dans un email).
- [ ] Un participant sans aucune acquisition voit un état clair, pas une page vide.

## Hors périmètre
Tout envoi d'email automatique. L'historique multi-saisons. Le dépouillement lui-même.

## Dépendances
BRIEF-05 (les retraits motivés et les statuts doivent exister).

## Budget et conditions d'arrêt
- ~5 fichiers : page participant, vue admin, endpoint de lecture des résultats, tests.
- Arrêt SUCCÈS : critères verts, build local vert, PR ouverte.
- Arrêt SUSPENSION : donnée manquante côté BRIEF-05 → PLAN.md ## Blocages (préciser le champ manquant), ne pas la recalculer en doublon côté lecture.

## Vérification
Parcours manuel sur DB locale dépouillée : vue participant et récap admin comparés aux données. Le récap copié-collé dans un éditeur de texte reste lisible.

## Questions ouvertes
(aucune)
