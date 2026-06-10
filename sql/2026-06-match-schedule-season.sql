-- Migration : MATCH_SCHEDULE multi-saisons (chantier "lancement de saison").
-- Additive + réindexation de la clé unique. À appliquer MANUELLEMENT sur le
-- serveur OVH AVANT de pousser le code qui filtre par season (auto-deploy).
--
-- Vérifs préalables (résultats attendus, constatés le 2026-06-10) :
--   SHOW INDEX FROM MATCH_SCHEDULE;
--     -> unique_match = (matchday, home_team, away_team)
--   SELECT COUNT(*) FROM MATCH_SCHEDULE;  -- ~306 lignes, toutes saison 2025-2026

-- 1. Colonne season : les lignes existantes sont toutes 2025-2026 (DEFAULT).
ALTER TABLE MATCH_SCHEDULE
  ADD COLUMN season VARCHAR(20) NOT NULL DEFAULT '2025-2026' AFTER matchday;

-- 2. La clé unique doit inclure la saison, sinon le sync de la saison N+1
--    écraserait les matches de la saison N (même journée, mêmes équipes).
ALTER TABLE MATCH_SCHEDULE
  DROP INDEX unique_match,
  ADD UNIQUE KEY unique_match (season, matchday, home_team, away_team);

-- 3. Index de lecture (toutes les requêtes runtime filtrent season + matchday).
ALTER TABLE MATCH_SCHEDULE
  ADD INDEX idx_season_matchday (season, matchday);

-- Rollback :
--   ALTER TABLE MATCH_SCHEDULE DROP INDEX idx_season_matchday;
--   ALTER TABLE MATCH_SCHEDULE DROP INDEX unique_match,
--     ADD UNIQUE KEY unique_match (matchday, home_team, away_team);
--   ALTER TABLE MATCH_SCHEDULE DROP COLUMN season;
