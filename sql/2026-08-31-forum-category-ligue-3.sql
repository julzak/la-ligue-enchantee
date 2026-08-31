-- Migration forum : le dossier Ligue 3 utilise désormais le slug 'ligue-3'
-- (aligné sur le nom de la ligue 2026-2027). Les topics rattachés au slug
-- historique 'national-1' sont basculés. À appliquer AVANT le deploy du code
-- qui liste le dossier sous 'ligue-3' (l'ancienne URL reste servie en alias).
UPDATE FORUM_TOPIC SET category = 'ligue-3' WHERE category = 'national-1';
