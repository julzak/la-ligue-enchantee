# BRIEF-02 — Heure butoir et clôture des tours

## Objectif
Le participant connaît l'heure butoir du tour et toute soumission en retard est rejetée par le serveur, sans dépendre d'une action humaine au bon moment.

## Contexte
- Règle 3.1 + amendement du 2026-06-10 (`docs/regles-encheres.md` §7) : la clôture reste une action admin (« Clôturer le tour ») ; le butoir est OPTIONNEL, mais s'il est renseigné, rejet à tolérance zéro, timestamp serveur faisant foi.
- Aujourd'hui : fermeture 100% manuelle, aucun champ deadline. Table AUCTION (current_round), mise via `/api/auction` POST.
- UI participant : `src/app/ligue/[slug]/encheres`. UI admin : `src/app/admin/encheres`.
- Migration : livrer `sql/2026-06-encheres-deadline.sql` (+ rollback commenté). NE PAS l'exécuter : Julien l'applique avant le merge (cf tasks/pipeline.md).

## Critères d'acceptation
- [ ] L'admin peut renseigner (ou laisser vide) une heure butoir à l'ouverture d'un tour et la modifier tant que le tour est ouvert.
- [ ] Le participant voit l'heure butoir et un compte à rebours sur la page de mise ; sans butoir renseigné, il voit « clôture manuelle par l'admin ».
- [ ] Une soumission reçue par le serveur après le butoir est rejetée avec un message clair (« Tour clôturé le … à … »), même si la page était ouverte avant.
- [ ] Le bouton admin « Clôturer le tour » fonctionne dans tous les cas, butoir ou pas.
- [ ] Le rejet est testé côté serveur (cas du contrat : soumission à T+1 s → rejet).

## Hors périmètre
Le dépouillement (BRIEF-05). Aucun envoi de notification. Pas de fermeture automatique au butoir (le butoir rejette les mises, la clôture reste un acte admin).

## Dépendances
Aucune (la vérification serveur peut s'écrire sans le moteur).

## Budget et conditions d'arrêt
- ~6 fichiers : schema.prisma + sql/, `/api/auction`, `/api/admin/auction`, page mise, page admin.
- Arrêt SUCCÈS : critères verts (test serveur du rejet inclus), build local vert, PR ouverte signalant la migration à appliquer AVANT merge.
- Arrêt SUSPENSION : ambiguïté de règle ou conflit de schéma → PLAN.md ## Blocages.

## Vérification
Test vitest du rejet à T+1 s. Vérification manuelle : ouvrir un tour avec butoir à +2 min, soumettre avant (OK) et après (rejet, message).

## Questions ouvertes
(aucune)
