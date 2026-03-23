-- Migration: Mercato d'hiver support
-- Run this against the production database before deploying

-- 1. Add type column to AUCTION (default 'summer' for existing rows)
ALTER TABLE AUCTION ADD COLUMN type VARCHAR(10) NOT NULL DEFAULT 'summer';

-- 2. Add player_out_id column to AUCTION_BID (for winter 1-IN/1-OUT rule)
ALTER TABLE AUCTION_BID ADD COLUMN player_out_id INT UNSIGNED NULL DEFAULT NULL;

-- 3. Create AUCTION_BUDGET table for per-user budgets (winter mercato)
CREATE TABLE IF NOT EXISTS AUCTION_BUDGET (
  auction_id INT NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  budget INT NOT NULL DEFAULT 0,
  PRIMARY KEY (auction_id, user_id)
);
