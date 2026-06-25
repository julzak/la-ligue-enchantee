# BRIEF-11 — Saisie manuelle admin

## Objectif

Permettre à un administrateur de saisir une mise **au nom d'un participant**
retardataire, en **contournant l'heure butoir**, tout en réutilisant **à
l'identique** la validation de composition d'une soumission participant
(budget, quotas, gardien unique, joueurs déjà attribués). Aucune règle dupliquée :
la même fonction `validateSummerBids` juge le chemin participant et le chemin admin.

Cas d'usage : un participant n'a pas soumis avant la clôture / le butoir ; au lieu
de le pénaliser au dépouillement, l'admin saisit sa mise manuellement avant de
dépouiller le tour.

## Critères d'acceptation (parcours admin)

1. Sur la console enchères (`/admin/encheres`), un bloc **« Saisir une mise pour
   un participant »** apparaît uniquement quand un tour est **ouvert** ou
   **clôturé** (jamais après dépouillement).
2. L'admin choisit un participant dans la liste ; l'UI affiche son **budget
   restant** (130 − acquis) et le décompte de joueurs.
3. L'admin recherche des **joueurs libres** (même endpoint `/api/admin/jokers/free`
   et mêmes patterns que la page participant), saisit un montant par joueur.
4. Les **avertissements de quotas** affichés sont exactement ceux que le
   participant verrait (`validateSubmission` du moteur) ; l'excès de gardiens est
   bloquant comme côté participant.
5. Le bouton **« Enregistrer la mise pour [Prénom Nom] »** demande une
   **confirmation explicite** mentionnant le contournement du butoir.
6. À la validation, l'action API `enter-bid-for-user` :
   - rejette si le tour n'est pas `open`/`closed` ;
   - rejette si le participant cible n'appartient pas à la ligue ;
   - rejoue `validateSummerBids` (mêmes erreurs, mêmes codes que `POST /api/auction`) ;
   - **n'applique PAS** la garde deadline ;
   - remplace les mises `pending` du participant pour le tour, puis insère les
     nouvelles avec `admin_entered_by` renseigné (ID admin de la session).
7. Une saisie admin invalide (budget dépassé via pénalité, quota, gardien,
   joueur déjà attribué) est rejetée avec la **même erreur** qu'une soumission
   participant invalide (couvert par les tests).

## Hors-périmètre

- Mercato d'hiver (1 IN / 1 OUT) : la saisie manuelle ne couvre que l'enchère d'été.
- Modification du moteur (`auction-engine.ts`) et de la logique de dépouillement /
  complétion d'office : inchangés.
- Édition / suppression a posteriori d'une mise admin déjà dépouillée.
- Notion de budget « dur » : conformément au règlement, un dépassement n'est pas
  bloqué à la saisie (pénalité au dépouillement) ; seul l'excès de gardiens bloque.

## Schéma d'audit (colonne `admin_entered_by`)

Nouvelle colonne `AUCTION_BID.admin_entered_by INT NULL` :
- `NULL`  → mise placée par le participant lui-même, ou complétion d'office.
- `<id>`  → mise saisie par l'admin d'ID donné (piste d'audit). La valeur écrite
  vient de la **session admin** (`requireAdmin`), pas du payload client.

Aucune contrainte de clé étrangère (cohérence avec le reste de `AUCTION_BID`,
géré en SQL brut). Référence logique : `USER.ID_USER`.

## Migration SQL à appliquer AVANT le merge

Fichier : `sql/BRIEF-11-admin-bid-audit.sql` (additif, nullable, sans valeur par
défaut non-nulle). À appliquer **manuellement** sur la base MySQL :

```sql
ALTER TABLE AUCTION_BID
  ADD COLUMN admin_entered_by INT NULL DEFAULT NULL
  COMMENT 'ID de l''admin ayant saisi cette mise au nom du participant (BRIEF-11). NULL = mise placée par le participant.';
```

Rollback : `ALTER TABLE AUCTION_BID DROP COLUMN admin_entered_by;`

## Réutilisation (pas de duplication)

- Validation extraite dans **`src/lib/auction-validation.ts`** →
  `validateSummerBids(db, auctionId, userId, bids)`.
- Importée par `src/app/api/auction/route.ts` (chemin participant été) **et**
  `src/app/api/admin/auction/route.ts` (action `enter-bid-for-user`).
- Tests : `src/lib/auction-validation.test.ts` (DB mockée, 0 accès réel).
