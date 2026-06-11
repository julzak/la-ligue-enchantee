-- Migration : persistance des retraits de pénalité du dépouillement (BRIEF-05).
-- Additive pure (nouvelle table, aucune table existante modifiée).
-- À appliquer MANUELLEMENT sur la base MySQL AVANT le merge de la PR.
--
-- Contexte : règle 3.2.c (docs/regles-encheres.md). Chaque retrait appliqué
-- au dépouillement est persisté avec son motif lisible, pour consultation
-- (console admin BRIEF-05, page résultats participant BRIEF-06).
--
-- La mise retirée reste dans AUCTION_BID avec le statut 'removed' (nouvelle
-- valeur de la colonne status, qui contient déjà 'pending'/'won'/'lost'/'tie' ;
-- aucun changement de schéma nécessaire sur AUCTION_BID). Les points d'une
-- mise 'removed' ne comptent plus dans le budget dépensé (restitution 3.2.b).

CREATE TABLE IF NOT EXISTS AUCTION_REMOVAL (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  auction_id INT UNSIGNED NOT NULL,
  round INT NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  player_id INT UNSIGNED NOT NULL,
  amount INT NOT NULL COMMENT 'Points misés sur l acquisition retirée (restitués)',
  reason VARCHAR(255) NOT NULL COMMENT 'Motif lisible du retrait (règle 3.2.c)',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_auction_round (auction_id, round),
  KEY idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Rollback :
--   DROP TABLE AUCTION_REMOVAL;
--   (et, si besoin, UPDATE AUCTION_BID SET status='won' WHERE status='removed';)
