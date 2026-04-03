-- Migration: SCORING_CONFIG + MERCATO_CONFIG tables
-- Run: ssh ligue-ovh "mysql -u ligueenc -p'Laligue2026' ligueenc_v3 < sql/003-scoring-mercato-config.sql"

CREATE TABLE IF NOT EXISTS SCORING_CONFIG (
  id INT AUTO_INCREMENT PRIMARY KEY,
  season VARCHAR(20) NOT NULL DEFAULT '2025-2026',
  goal_bonus_gk INT NOT NULL DEFAULT 10,
  goal_bonus_def INT NOT NULL DEFAULT 4,
  goal_bonus_mid INT NOT NULL DEFAULT 2,
  goal_bonus_att INT NOT NULL DEFAULT 2,
  csc_malus INT NOT NULL DEFAULT -2,
  penalty_saved_bonus INT NOT NULL DEFAULT 2,
  red_card_note_zero TINYINT NOT NULL DEFAULT 1,
  min_note DECIMAL(3,1) NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY (season)
);

CREATE TABLE IF NOT EXISTS MERCATO_CONFIG (
  id INT AUTO_INCREMENT PRIMARY KEY,
  season VARCHAR(20) NOT NULL DEFAULT '2025-2026',
  type ENUM('winter','summer') NOT NULL,
  ranking_matchday INT DEFAULT NULL,
  treve_start DATE DEFAULT NULL,
  treve_end DATE DEFAULT NULL,
  UNIQUE KEY (season, type)
);

-- Default rows
INSERT IGNORE INTO SCORING_CONFIG (season) VALUES ('2025-2026');
INSERT IGNORE INTO MERCATO_CONFIG (season, type) VALUES ('2025-2026', 'winter');
INSERT IGNORE INTO MERCATO_CONFIG (season, type) VALUES ('2025-2026', 'summer');
