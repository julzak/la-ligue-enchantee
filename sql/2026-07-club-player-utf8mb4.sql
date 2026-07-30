-- 2026-07-30 : conversion CLUB + PLAYER en utf8mb4.
--
-- Contexte : l'import des effectifs (admin/nouvelle-saison phase 2) plantait
-- avec l'erreur MySQL 3988 ("Conversion from collation utf8mb4_general_ci
-- into latin1_swedish_ci impossible") dès qu'un nom de joueur contenait un
-- caractère hors latin1 (Š, ć, ø, ğ...). Tables héritées de l'ancien site
-- restées en latin1_swedish_ci alors que le reste de la base est en utf8mb4.
--
-- Vérifié avant migration : les données existantes sont en latin1 propre
-- (é stocké 0xE9, pas de mojibake), la conversion MySQL est donc fidèle.
-- Aucune jointure texte : toutes les relations passent par des FK entières.
-- SCORE / TEAM / TEAM_DAY sont 100% numériques, pas de contagion.
--
-- Backup avant application (fait le 2026-07-30 sur le VPS) :
--   sudo mysqldump ligueenc_v3 CLUB PLAYER > ~/backup-club-player-20260730.sql
-- Rollback :
--   sudo mysql ligueenc_v3 < ~/backup-club-player-20260730.sql

ALTER TABLE CLUB   CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE PLAYER CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
