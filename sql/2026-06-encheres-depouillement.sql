-- Migration : persistance des retraits de pénalité du dépouillement (BRIEF-05).
-- À appliquer MANUELLEMENT sur la base MySQL AVANT le merge de la PR.
--
-- Contexte : règle 3.2.c (docs/regles-encheres.md). Chaque retrait appliqué
-- au dépouillement est persisté avec son motif lisible, pour consultation
-- (console admin BRIEF-05, page résultats participant BRIEF-06).
--
-- FAIT VÉRIFIÉ EN PROD (2026-06-11) :
--   AUCTION.status     = ENUM('open','closed','resolved')
--   AUCTION_BID.status = ENUM('pending','won','lost','tie')
-- sql_mode = STRICT_TRANS_TABLES → 'tallied' et 'removed' provoqueraient
-- une erreur 1265 (Data truncated) si les colonnes restaient ENUM.
-- => Les deux colonnes sont converties en VARCHAR(20) AVANT toute écriture.
-- TEAM est en MyISAM : pas de rollback transactionnel sur les INSERT TEAM ;
-- la logique de reprise de close-phase gère cela applicativement (voir route.ts).

-- ── Étape 1 : conversion ENUM → VARCHAR(20) ────────────────────────────────
-- Les valeurs existantes ('open','closed','resolved','pending','won','lost','tie')
-- sont préservées par MySQL lors d'un MODIFY de ENUM vers VARCHAR.
ALTER TABLE AUCTION
  MODIFY status VARCHAR(20) NOT NULL DEFAULT 'open';

ALTER TABLE AUCTION_BID
  MODIFY status VARCHAR(20) NOT NULL DEFAULT 'pending';

-- ── Étape 2 : nouvelle table AUCTION_REMOVAL ───────────────────────────────
-- La mise retirée reste dans AUCTION_BID avec le statut 'removed' (rendu
-- possible par la conversion VARCHAR ci-dessus). Les points d'une mise
-- 'removed' ne comptent plus dans le budget dépensé (restitution 3.2.b).
-- La contrainte UNIQUE (auction_id, round, user_id, player_id) empêche
-- un double dépouillement du même tour d'insérer deux fois le même retrait.
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
  UNIQUE KEY uq_removal (auction_id, round, user_id, player_id),
  KEY idx_auction_round (auction_id, round),
  KEY idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Rollback ───────────────────────────────────────────────────────────────
-- DROP TABLE AUCTION_REMOVAL;
-- ALTER TABLE AUCTION_BID MODIFY status ENUM('pending','won','lost','tie') NOT NULL DEFAULT 'pending';
-- ALTER TABLE AUCTION MODIFY status ENUM('open','closed','resolved') NOT NULL DEFAULT 'open';
