-- Migration : gel des jokers pendant le mercato d'hiver (demande Pierre 2026-08-18).
-- Fenêtre de gel stockée sur la ligne winter de MERCATO_CONFIG, en DATETIME
-- (la fin a une heure : "2 février 20h"). Les colonnes treve_start/treve_end
-- (DATE) restent la trêve sportive, sémantique différente, on n'y touche pas.
-- Convention temps : DATETIME naïf comparé à l'heure locale du serveur
-- (Europe/Paris), comme les deadlines JOKER_CONFIG existantes.
--
-- À appliquer manuellement AVANT le deploy du code qui lit ces colonnes.

ALTER TABLE MERCATO_CONFIG
  ADD COLUMN jokers_freeze_start DATETIME DEFAULT NULL,
  ADD COLUMN jokers_freeze_end DATETIME DEFAULT NULL;

-- Fenêtre 2026-2027 annoncée par Pierre : du 1er janvier au 2 février 20h.
-- Modifiable ensuite dans Admin -> Configuration (section Mercato d'hiver).
INSERT INTO MERCATO_CONFIG (season, type, jokers_freeze_start, jokers_freeze_end)
VALUES ('2026-2027', 'winter', '2027-01-01 00:00:00', '2027-02-02 20:00:00')
ON DUPLICATE KEY UPDATE
  jokers_freeze_start = '2027-01-01 00:00:00',
  jokers_freeze_end = '2027-02-02 20:00:00';
