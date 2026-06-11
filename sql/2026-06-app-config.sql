-- Migration : table de configuration applicative clé/valeur (chantier
-- effectifs/photos). Stocke notamment les clés API saisies par les admins
-- (football-data.org pour les effectifs, TheSportsDB premium pour les
-- photos) afin qu'aucun changement de clé ne nécessite SSH ni redéploiement.
-- Additive pure. À appliquer MANUELLEMENT sur le serveur OVH AVANT le push.

CREATE TABLE IF NOT EXISTS APP_CONFIG (
  NAME VARCHAR(50) NOT NULL PRIMARY KEY,
  VALUE TEXT NULL,
  UPDATED_AT DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Rollback :
--   DROP TABLE APP_CONFIG;
