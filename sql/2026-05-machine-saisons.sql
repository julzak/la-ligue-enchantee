-- =============================================================================
-- Migration : Machine à saisons (Chantier 1 — modèle de données Season)
-- Date      : 2026-05-30
-- Cible     : MySQL prod ligueenc_v3 (VPS OVH)
-- Nature    : ADDITIVE PURE. Aucune table existante modifiée destructivement.
--             - 2 nouvelles tables (SEASON, PALMARES)
--             - 3 colonnes nullable ajoutées sur CLUB / LEAGUE / PLAYER
--             Aucune donnée historique touchée (toutes les nouvelles colonnes
--             restent NULL pour l'existant : seasonId nullable, historique intact).
--
-- IMPORTANT : ce projet n'utilise PAS Prisma Migrate (schéma introspecté via
-- db pull). On applique donc ce DDL à la main. À exécuter sur le serveur qui
-- a accès TCP/3306 (l'IP du dev local n'est pas whitelistée).
--
-- Application (après relecture) :
--   ssh ligue-ovh
--   mysql -h <host> -u <user> -p ligueenc_v3 < sql/2026-05-machine-saisons.sql
-- puis sur le repo : git pull && npx prisma generate && npm run build && pm2 restart ligue
--
-- Rollback complet en bas de fichier (commenté).
--
-- VÉRIFS PRÉALABLES À LANCER SUR LE SERVEUR AVANT D'APPLIQUER (revue externe) :
--   -- 1. Les tables filles doivent être InnoDB (sinon les FK échouent) :
--   SELECT TABLE_NAME, ENGINE FROM information_schema.TABLES
--     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('CLUB','LEAGUE','PLAYER');
--   -- 2. Les colonnes d'ancrage AFTER (NAME / FIRST_YEAR / LINK) et le type
--   --    INT UNSIGNED des PK doivent exister tels quels :
--   DESCRIBE `CLUB`; DESCRIBE `LEAGUE`; DESCRIBE `PLAYER`;
--   Si une table est en MyISAM : la convertir (ALTER TABLE x ENGINE=InnoDB) ou
--   retirer les `ADD CONSTRAINT ... FOREIGN KEY` (garder seulement les ADD KEY).
--   Les clauses AFTER sont cosmétiques : supprimables sans impact en cas de doute.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Table SEASON
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `SEASON` (
  `ID_SEASON`  INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `LABEL`      VARCHAR(20)  NOT NULL,
  `STATUS`     ENUM('SETUP','AUCTION','ACTIVE','WINTER','CLOSED') NOT NULL DEFAULT 'SETUP',
  `STARTED_AT` DATETIME     NULL,
  `CLOSED_AT`  DATETIME     NULL,
  `IS_CURRENT` TINYINT(1)   NOT NULL DEFAULT 0,
  PRIMARY KEY (`ID_SEASON`),
  KEY `STATUS` (`STATUS`),
  KEY `IS_CURRENT` (`IS_CURRENT`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------
-- 2. Table PALMARES
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `PALMARES` (
  `ID_PALMARES`    INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `ID_SEASON`      INT UNSIGNED NOT NULL,
  `DIVISION_LABEL` VARCHAR(50)  NOT NULL,
  `POSITION`       VARCHAR(20)  NOT NULL,
  `PSEUDO`         VARCHAR(150) NOT NULL,
  PRIMARY KEY (`ID_PALMARES`),
  KEY `ID_SEASON_PALMARES` (`ID_SEASON`),
  CONSTRAINT `FK_PALMARES_SEASON`
    FOREIGN KEY (`ID_SEASON`) REFERENCES `SEASON` (`ID_SEASON`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------
-- 2bis. Table SEASON_MOVEMENT (montées/descentes calculées à la clôture +
--       override admin pour repêchages). Chantier 4.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `SEASON_MOVEMENT` (
  `ID_MOVEMENT`    INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `ID_SEASON`      INT UNSIGNED NOT NULL,
  `ID_USER`        INT UNSIGNED NOT NULL,
  `FROM_LEAGUE_ID` INT UNSIGNED NOT NULL,
  `FROM_TIER`      INT          NOT NULL,
  `TO_TIER`        INT          NOT NULL,
  `TYPE`           ENUM('PROMOTION','RELEGATION','STAY') NOT NULL,
  `RANK_FINAL`     INT          NOT NULL,
  `PSEUDO`         VARCHAR(150) NOT NULL,
  `OVERRIDDEN`     TINYINT(1)   NOT NULL DEFAULT 0,
  PRIMARY KEY (`ID_MOVEMENT`),
  KEY `ID_SEASON_MOVEMENT` (`ID_SEASON`),
  CONSTRAINT `FK_MOVEMENT_SEASON`
    FOREIGN KEY (`ID_SEASON`) REFERENCES `SEASON` (`ID_SEASON`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------
-- NOTE moteur : CLUB / LEAGUE / PLAYER sont en MyISAM (vérifié sur la prod
-- 2026-05-30). MyISAM ne supporte PAS les clés étrangères. On ajoute donc
-- seulement les colonnes + index sur ces 3 tables (PAS de ADD CONSTRAINT),
-- pour ne pas faire échouer l'ALTER. Le rattachement saison est garanti côté
-- application (seasonId écrit par les server actions). Les tables neuves
-- (SEASON, PALMARES, SEASON_MOVEMENT) sont en InnoDB et gardent leurs FK.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 3. Colonne saison sur CLUB (MyISAM : colonne + index, sans FK)
-- ---------------------------------------------------------------------------
ALTER TABLE `CLUB`
  ADD COLUMN `ID_SEASON` INT UNSIGNED NULL AFTER `NAME`,
  ADD KEY `ID_SEASON_CLUB` (`ID_SEASON`);

-- ---------------------------------------------------------------------------
-- 4. Colonnes saison + division sur LEAGUE (MyISAM : sans FK)
-- ---------------------------------------------------------------------------
ALTER TABLE `LEAGUE`
  ADD COLUMN `ID_SEASON`      INT UNSIGNED NULL AFTER `FIRST_YEAR`,
  ADD COLUMN `DIVISION_LABEL` VARCHAR(50)  NULL AFTER `ID_SEASON`,
  ADD COLUMN `TIER`           INT          NULL AFTER `DIVISION_LABEL`,
  ADD KEY `ID_SEASON_LEAGUE` (`ID_SEASON`);

-- ---------------------------------------------------------------------------
-- 5. Colonne saison sur PLAYER (MyISAM : sans FK)
-- ---------------------------------------------------------------------------
ALTER TABLE `PLAYER`
  ADD COLUMN `ID_SEASON` INT UNSIGNED NULL AFTER `LINK`,
  ADD KEY `ID_SEASON_PLAYER` (`ID_SEASON`);

-- =============================================================================
-- ROLLBACK (à exécuter manuellement en cas de besoin, dans cet ordre) :
-- =============================================================================
-- ALTER TABLE `PLAYER` DROP KEY `ID_SEASON_PLAYER`, DROP COLUMN `ID_SEASON`;
-- ALTER TABLE `LEAGUE` DROP KEY `ID_SEASON_LEAGUE`, DROP COLUMN `TIER`,
--   DROP COLUMN `DIVISION_LABEL`, DROP COLUMN `ID_SEASON`;
-- ALTER TABLE `CLUB` DROP KEY `ID_SEASON_CLUB`, DROP COLUMN `ID_SEASON`;
-- DROP TABLE IF EXISTS `SEASON_MOVEMENT`;
-- DROP TABLE IF EXISTS `PALMARES`;
-- DROP TABLE IF EXISTS `SEASON`;
