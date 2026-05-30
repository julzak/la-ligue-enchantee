# Demande de relecture SQL — à coller dans Claude.ai

Copie-colle TOUT ce qui suit (de la ligne "===" jusqu'en bas) dans une
conversation Claude.ai. Il aura le contexte + le schéma actuel + la migration,
de quoi juger sans rien deviner.

=============================================================================

Tu es un expert MySQL. Je vais appliquer une migration de schéma sur une base
de PRODUCTION MySQL (un jeu fantasy football avec ~20 ans d'historique, base
`ligueenc_v3`, moteur InnoDB). Je ne sais pas lire le SQL moi-même. Juge si
cette migration est SÛRE et PERTINENTE, et dis-moi clairement OUI on applique
ou NON il y a un problème. Sois précis sur tout risque pour les données existantes.

OBJECTIF FONCTIONNEL de la migration :
Ajouter la notion de "saison" au jeu. Aujourd'hui la base n'a qu'une seule
saison implicite. Je veux pouvoir relancer une nouvelle saison chaque année
(nouveaux clubs, joueurs, ligues) sans écraser l'historique. Contrainte forte :
l'historique existant NE DOIT PAS être touché ni cassé.

STRUCTURE ACTUELLE des 3 tables modifiées (extrait du schéma Prisma) :

  model Club {
    id       Int    @id @default(autoincrement()) @map("ID_CLUB") @db.UnsignedInt
    idClubEq String @map("ID_CLUB_EQ") @db.VarChar(10)
    name     String @default("") @map("NAME") @db.VarChar(50)
  }

  model League {
    id        Int    @id @default(autoincrement()) @map("ID_LEAGUE") @db.UnsignedInt
    chiefId   Int    @default(0) @map("ID_CHIEF")
    forumId   Int    @default(0) @map("ID_FORUM")
    name      String @default("") @map("NAME") @db.VarChar(50)
    firstYear Int    @default(0) @map("FIRST_YEAR")
  }

  model Player {
    id       Int     @id @default(autoincrement()) @map("ID_PLAYER") @db.UnsignedInt
    clubId   Int     @default(0) @map("ID_CLUB") @db.UnsignedInt
    fname    String  @default("") @map("FNAME") @db.VarChar(50)
    lname    String  @default("") @map("LNAME") @db.VarChar(50)
    position String  @default("") @map("POSITION") @db.VarChar(50)
    link     String? @map("LINK") @db.VarChar(150)
  }

Toutes les PK sont des INT UNSIGNED AUTO_INCREMENT. Les noms de colonnes en base
sont en MAJUSCULES (ID_CLUB, NAME, etc.).

QUESTIONS PRÉCISES auxquelles je veux une réponse :
1. Cette migration peut-elle perdre ou corrompre des données existantes ? (Je
   veux un OUI/NON net.)
2. Les nouvelles colonnes sont-elles bien optionnelles (NULL) pour que les
   lignes existantes restent valides sans valeur de saison ?
3. Les clés étrangères (FK) sont-elles correctes et ne vont-elles pas bloquer
   des insertions/suppressions normales du jeu ?
4. Y a-t-il un risque de lenteur ou de verrou long pendant l'ALTER sur une
   grosse table ? (La plus grosse table ici fait quelques milliers de lignes.)
5. Le rollback fourni en bas du fichier est-il correct et complet ?
6. Quelque chose manque-t-il ou est-il maladroit ?

VOICI LA MIGRATION À JUGER :

```sql
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

ALTER TABLE `CLUB`
  ADD COLUMN `ID_SEASON` INT UNSIGNED NULL AFTER `NAME`,
  ADD KEY `ID_SEASON_CLUB` (`ID_SEASON`),
  ADD CONSTRAINT `FK_CLUB_SEASON`
    FOREIGN KEY (`ID_SEASON`) REFERENCES `SEASON` (`ID_SEASON`);

ALTER TABLE `LEAGUE`
  ADD COLUMN `ID_SEASON`      INT UNSIGNED NULL AFTER `FIRST_YEAR`,
  ADD COLUMN `DIVISION_LABEL` VARCHAR(50)  NULL AFTER `ID_SEASON`,
  ADD COLUMN `TIER`           INT          NULL AFTER `DIVISION_LABEL`,
  ADD KEY `ID_SEASON_LEAGUE` (`ID_SEASON`),
  ADD CONSTRAINT `FK_LEAGUE_SEASON`
    FOREIGN KEY (`ID_SEASON`) REFERENCES `SEASON` (`ID_SEASON`);

ALTER TABLE `PLAYER`
  ADD COLUMN `ID_SEASON` INT UNSIGNED NULL AFTER `LINK`,
  ADD KEY `ID_SEASON_PLAYER` (`ID_SEASON`),
  ADD CONSTRAINT `FK_PLAYER_SEASON`
    FOREIGN KEY (`ID_SEASON`) REFERENCES `SEASON` (`ID_SEASON`);

-- ROLLBACK (à exécuter dans cet ordre en cas de besoin) :
-- ALTER TABLE `PLAYER` DROP FOREIGN KEY `FK_PLAYER_SEASON`, DROP KEY `ID_SEASON_PLAYER`, DROP COLUMN `ID_SEASON`;
-- ALTER TABLE `LEAGUE` DROP FOREIGN KEY `FK_LEAGUE_SEASON`, DROP KEY `ID_SEASON_LEAGUE`, DROP COLUMN `TIER`, DROP COLUMN `DIVISION_LABEL`, DROP COLUMN `ID_SEASON`;
-- ALTER TABLE `CLUB` DROP FOREIGN KEY `FK_CLUB_SEASON`, DROP KEY `ID_SEASON_CLUB`, DROP COLUMN `ID_SEASON`;
-- DROP TABLE IF EXISTS `PALMARES`;
-- DROP TABLE IF EXISTS `SEASON`;
```

=============================================================================
RETOUR DE LA RELECTURE (Claude.ai, 2026-05-30) : VERDICT = SÛR à exécuter,
sous réserve de 3 vérifs préalables à lancer SUR LE SERVEUR. Ces 3 requêtes
sont incluses en tête du fichier sql/2026-05-machine-saisons.sql. Résumé :

  1. Moteur InnoDB des tables CLUB/LEAGUE/PLAYER (les FK n'existent qu'en InnoDB).
     Si MyISAM : convertir en InnoDB, ou retirer les ADD CONSTRAINT (garder ADD KEY).
  2. Colonnes d'ancrage AFTER (NAME / FIRST_YEAR / LINK) présentes. Sinon retirer
     les clauses AFTER (purement cosmétiques).
  3. PK des tables existantes en INT UNSIGNED (cohérence de type des FK).

Non bloquant noté : IS_CURRENT n'a pas de contrainte d'unicité en base (MySQL
ne supporte pas les index uniques partiels). L'unicité "une seule saison
courante" est garantie côté application (PATCH /api/admin/seasons : transaction
qui remet les autres saisons à isCurrent=0).
=============================================================================
