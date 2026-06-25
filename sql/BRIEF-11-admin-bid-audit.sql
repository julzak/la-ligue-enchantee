-- Migration : traçabilité des mises saisies manuellement par un admin.
-- Additive pure (nullable, aucune valeur par défaut non-nulle).
-- À appliquer MANUELLEMENT sur la base MySQL AVANT le merge de la PR.
--
-- Contexte : BRIEF-11 (saisie manuelle admin). L'admin peut saisir une mise
-- AU NOM d'un participant retardataire (action API `enter-bid-for-user`), en
-- contournant l'heure butoir mais en réutilisant à l'identique la validation
-- de composition (budget, quotas, gardien, joueurs déjà attribués).
--
-- admin_entered_by enregistre l'ID de l'admin qui a effectué la saisie.
--   - NULL  = mise placée par le participant lui-même (cas normal) ou complétion
--             d'office (action `complete-roster`) — aucune saisie admin.
--   - <id>  = mise saisie manuellement par l'admin d'ID donné (piste d'audit).
--
-- Aucune contrainte de clé étrangère ajoutée (cohérence avec le reste du schéma
-- AUCTION_BID, géré en SQL brut). La colonne référence logiquement USER.ID_USER.

ALTER TABLE AUCTION_BID
  ADD COLUMN admin_entered_by INT NULL DEFAULT NULL
  COMMENT 'ID de l''admin ayant saisi cette mise au nom du participant (BRIEF-11). NULL = mise placée par le participant.';

-- Rollback :
--   ALTER TABLE AUCTION_BID DROP COLUMN admin_entered_by;
