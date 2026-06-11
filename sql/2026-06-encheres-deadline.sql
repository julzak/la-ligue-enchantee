-- Migration : ajout d'une heure butoir optionnelle par tour d'enchères.
-- Additive pure (nullable, aucune valeur par défaut non-nulle).
-- À appliquer MANUELLEMENT sur la base MySQL AVANT le merge de la PR.
--
-- Contexte : BRIEF-02, règle 3.1 + amendement 2026-06-10.
-- Si round_deadline IS NOT NULL, toute soumission dont le timestamp serveur
-- est >= round_deadline est rejetée (tolérance 0). La fermeture manuelle
-- (action admin "close-round") fonctionne dans tous les cas, deadline ou non.

ALTER TABLE AUCTION
  ADD COLUMN round_deadline DATETIME NULL DEFAULT NULL COMMENT 'Heure butoir optionnelle du tour en cours (timestamp UTC). NULL = fermeture manuelle uniquement.';

-- Rollback :
--   ALTER TABLE AUCTION DROP COLUMN round_deadline;
