# BRIEF-09 — Durcissements de saisie (findings post-recette BRIEF-07)

## Objectif
Deux durcissements défensifs sur l'entrée des mises, issus de la recette
simulée (BRIEF-07). Aucun ne corrige un bug de règlement ni du moteur de
dépouillement : ce sont des garde-fous d'entrée.

## Contenu
1. **Garde B3 — doublon de playerId dans une soumission.**
   `POST /api/auction` acceptait deux mises sur le même playerId dans un même
   payload et les persistait en deux lignes AUCTION_BID, faussant le décompte
   (quotas, pénalité « >13 »). Helper pur `src/lib/auction-duplicate-bids.ts`
   (`findDuplicatePlayerIds`), garde ajoutée après la validation `amount > 0`,
   avant tout I/O. Choix : **rejet** (cohérent avec B0/B0b/B2-GK), pas
   déduplication silencieuse. Un payload à doublon est malformé ; aucun flux
   UI légitime ne le produit.

2. **`lineFromPosition` robuste au vocabulaire de postes.**
   Le mapping ne reconnaissait que les libellés français complets. Il tolère
   désormais aussi les codes courts (« G/DEF/MIL/ATT/MID ») et les préfixes
   numériques (« 2 - Défense », qui est le format réel de prod). NB : la prod
   en libellés complets fonctionnait déjà ; ce durcissement supprime
   l'incohérence connue entre `positionToLine` (UI, accepte le court) et le
   moteur, qui avait faussé la 1re recette (postes de fixture en codes courts
   classés tous en MID). Défaut de fixture corrigé par ailleurs (BRIEF-07),
   ce durcissement est la ceinture en plus des bretelles.

## Critères d'acceptation
- [x] Doublon de playerId rejeté (400) avec message indiquant le joueur fautif.
- [x] `lineFromPosition` mappe correctement court, long et préfixé.
- [x] Tests vitest pour les deux (dont sanity-check du détecteur de doublon).
- [x] Moteur de dépouillement et règlement non modifiés.

## Hors périmètre
Pas de migration SQL. Pas de modification du moteur (`auction-engine.ts`) ni
du règlement.

## Vérification
`npm run lint && npm test && npm run build`. Merge réservé à Julien.
