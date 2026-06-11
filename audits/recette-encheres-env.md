# Environnement de recette E2E — Module enchères

**Créé le 2026-06-11 | Cible : agent BRIEF-07**

---

## Synthèse

Environnement de recette totalement isolé de la prod, basé sur :
- Un conteneur MySQL 8 Docker dédié (`ligue-recette-mysql`, port 3310)
- La base `ligueenc_recette` initialisée depuis le dump prod + migrations + seed fictif
- L'app Next.js buildée et exécutable sur le port 3100

La prod (tunnel 127.0.0.1:3307) n'a jamais été touchée.

---

## Comptes de recette

Tous les comptes partagent le mot de passe **`recette2026`** (stocké bcrypt en base).

| Login (champ "Identifiant") | Email                    | ID base |
|-----------------------------|--------------------------|---------|
| RecetteAdmin                | admin@recette.test       | 1460    |
| Joueur1                     | joueur1@recette.test     | 1461    |
| Joueur2                     | joueur2@recette.test     | 1462    |
| Joueur3                     | joueur3@recette.test     | 1463    |
| Joueur4                     | joueur4@recette.test     | 1464    |

Page de login : `http://localhost:3100/login`

Auth : next-auth credentials. Le champ login est le pseudo (`NAME` dans `USER`), pas l'email.

---

## Données en base (recette)

| Entité       | Valeur                                                                                      |
|-------------|----------------------------------------------------------------------------------------------|
| Saison       | `2026-2027`, statut `AUCTION`, `IS_CURRENT=1`, id #1                                        |
| Clubs        | 6 clubs fictifs (Recette FC, Fictif Paris, Mock United, Test Olympique, Demo Athletic, Sandbox City) |
| Joueurs      | 84 joueurs fictifs (G/DEF/MIL/ATT, noms type "Durand") + 6 pseudo-gardiens de club          |
| Ligue        | "Ligue Recette Enchères", id #24, slug URL = `ligue-recette-encheres`                        |
| Participants | 5 users de recette inscrits dans la ligue (IDs 1460-1464)                                    |

La saison est en statut `AUCTION` : le module enchères est actif pour cette ligue.

URL module enchères : `http://localhost:3100/ligue/ligue-recette-encheres/encheres`

---

## Commandes de démarrage / arrêt

### Prérequis
- Docker Desktop en cours d'exécution
- Working directory : `/Users/julienzakoian/Projects/la-ligue-enchantee`
- Build déjà effectué (`.next/` présent)

### 1. Démarrer le conteneur MySQL recette

```bash
docker start ligue-recette-mysql
```

Si le conteneur n'existe plus (recréation from scratch) :

```bash
docker run -d \
  --name ligue-recette-mysql \
  -e MYSQL_ROOT_PASSWORD=recette2026 \
  -e MYSQL_DATABASE=ligueenc_recette \
  -e MYSQL_USER=recette \
  -e MYSQL_PASSWORD=recette2026 \
  -p 3310:3306 \
  mysql:8 \
  --character-set-server=utf8mb4 \
  --collation-server=utf8mb4_unicode_ci
```

Puis attendre que MySQL soit prêt (10-15s), puis appliquer toutes les migrations (voir section "Migrations appliquées") et relancer les seeds.

### 2. Lancer l'app sur le port 3100

```bash
DATABASE_URL="mysql://recette:recette2026@127.0.0.1:3310/ligueenc_recette" \
NEXTAUTH_SECRET="recette-secret-2026" \
NEXTAUTH_URL="http://localhost:3100" \
PORT=3100 \
npm run start
```

Pour un lancement en arrière-plan :

```bash
DATABASE_URL="mysql://recette:recette2026@127.0.0.1:3310/ligueenc_recette" \
NEXTAUTH_SECRET="recette-secret-2026" \
NEXTAUTH_URL="http://localhost:3100" \
PORT=3100 \
npm run start > /tmp/ligue-recette.log 2>&1 &
```

### 3. Vérifier que l'app tourne

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3100/
# Attendu : 200
```

### 4. Arrêter l'app

```bash
kill $(lsof -ti :3100)
```

### 5. Arrêter le conteneur MySQL

```bash
docker stop ligue-recette-mysql
```

---

## Rebuild (si nécessaire)

Si le code a changé ou si `.next/` est absent :

```bash
DATABASE_URL="mysql://recette:recette2026@127.0.0.1:3310/ligueenc_recette" \
NEXTAUTH_SECRET="recette-secret-2026" \
NEXTAUTH_URL="http://localhost:3100" \
PORT=3100 \
npm run build
```

Note : `npm run build` inclut `prisma generate`, pas besoin de l'appeler séparément.

---

## Migrations appliquées (ordre chronologique)

Toutes appliquées sur `ligueenc_recette` le 2026-06-11 :

| Fichier / description                          | Statut   |
|------------------------------------------------|----------|
| Import dump `ligueenc_v3.sql` (prod mars 2026) | OK       |
| `sql/003-scoring-mercato-config.sql` — SCORING_CONFIG, MERCATO_CONFIG | OK |
| `sql/2026-05-machine-saisons.sql` — SEASON, PALMARES, SEASON_MOVEMENT + colonnes ID_SEASON sur CLUB/LEAGUE/PLAYER | OK (partiellement via script, partiellement manuelles) |
| `sql/2026-06-app-config.sql` — APP_CONFIG      | OK       |
| `sql/2026-06-encheres-deadline.sql` — AUCTION.round_deadline | OK |
| `sql/2026-06-match-schedule-season.sql` — MATCH_SCHEDULE.season + unique_match | OK |
| `migration-mercato-hiver.sql` — AUCTION.type, AUCTION_BID.player_out_id, AUCTION_BUDGET | OK |

Tables créées manuellement (absentes du dump et sans fichier sql/ dédié) :

| Table          | Source                                    |
|----------------|-------------------------------------------|
| AUCTION        | Reconstruit depuis le code (route.ts queries) |
| AUCTION_BID    | Idem                                      |
| AUCTION_BUDGET | `migration-mercato-hiver.sql`             |
| MATCH_SCHEDULE | Reconstruit depuis le code                |
| JOKER_CONFIG   | Reconstruit depuis le code                |
| JOKER_LOG      | Reconstruit depuis le code                |
| PAYMENT        | Reconstruit depuis le code                |
| SEASON         | Reconstruit depuis `machine-saisons.sql` DDL |
| PALMARES       | Idem                                      |
| SEASON_MOVEMENT| Idem                                      |
| CUP            | Reconstruit depuis le code                |
| CUP_MATCH      | Reconstruit depuis le code                |

Modification de schéma supplémentaire :
- `USER.PASSWORD` élargi de `VARCHAR(50)` à `VARCHAR(255)` (bcrypt hash = 60 chars)
- `SCORE` : ajout des colonnes `RED_CARD`, `OWN_GOALS`, `PENALTY_SAVED` absentes du dump

---

## Seeds exécutés

```bash
# Seed principal (saison + clubs + joueurs fictifs + users + ligue)
DATABASE_URL="mysql://recette:recette2026@127.0.0.1:3310/ligueenc_recette" \
./node_modules/.bin/tsx scripts/seed-recette-encheres.ts --apply

# Pseudo-gardiens de clubs (1 par club fictif)
DATABASE_URL="mysql://recette:recette2026@127.0.0.1:3310/ligueenc_recette" \
./node_modules/.bin/tsx scripts/seed-gardiens-club.ts --apply
```

Les deux scripts sont idempotents.

---

## Pièges rencontrés

### 1. `docker exec ... <<'HEREDOC'` ne fonctionne pas depuis les outils shell non-interactifs
La syntaxe heredoc avec stdin ne s'envoie pas correctement à `docker exec`. Contournement : écrire le SQL dans `/tmp/*.sql` puis `docker cp` + `source` ou `docker exec ... < fichier`.

### 2. `exit 1` ne signifie pas forcément une erreur MySQL
MySQL retourne exit 1 même pour des warnings (password on CLI). Toujours lire stderr pour distinguer warning/erreur réelle.

### 3. Le dump phpMyAdmin contient `CREATE DATABASE ligueenc_v3` et `USE ligueenc_v3`
Ces deux directives doivent être supprimées avant import dans `ligueenc_recette`. Fait par `grep -v` au moment de l'import.

### 4. Les tables CLUB/LEAGUE/PLAYER sont en MyISAM dans le dump
La migration `machine-saisons.sql` note ce fait et omet les FK pour ces tables. Les ALTER se sont appliqués, mais certaines colonnes nécessitaient une application manuelle car les `CREATE TABLE IF NOT EXISTS` intermédiaires échouaient silencieusement sur des tables déjà existantes.

### 5. `prisma.player.findFirst()` retourne "column does not exist"
Même si la colonne existe en base, Prisma peut retourner cette erreur si le build client est stale. Solution : `./node_modules/.bin/prisma generate` puis supprimer `.next/` et rebuilder.

### 6. `SCORING_CONFIG` manque les colonnes `deadline_hour`, `early_match_hour`, `early_match_offset_hours`
La migration 003 ne les crée pas. Le code de lancement de saison (`api/admin/seasons/launch`) les utilise via un clone `SELECT ... deadline_hour, early_match_hour, early_match_offset_hours`. Ces colonnes n'existent pas sur la base recette. Si le lancement de saison est nécessaire en recette, il faudra les ajouter manuellement :
```sql
ALTER TABLE SCORING_CONFIG
  ADD COLUMN deadline_hour INT NULL DEFAULT 11,
  ADD COLUMN early_match_hour INT NULL DEFAULT 9,
  ADD COLUMN early_match_offset_hours INT NULL DEFAULT 3;
```

### 7. Tables CUP / CUP_MATCH absentes du dump et sans fichier sql/
Ces tables existent en prod mais n'ont jamais été migrées via fichier versionné. Recréées manuellement en inférant la DDL depuis les queries dans `src/app/coupe/page.tsx` et `src/app/api/admin/cup/route.ts`.

---

## État vérifié

- Home (`/`) : HTTP 200 (test curl)
- Login Joueur1 / recette2026 : session retournée avec `userId: 1461`
- `/ligue/ligue-recette-encheres/encheres` : HTTP 200 (test curl authentifié)
- Serveur arrêté après vérification (environnement relançable)

---

## Fixes manuels appliqués en recette (smoke 2026-06-11)

Ces corrections ont été appliquées directement sur la base `ligueenc_recette` lors du premier run de smoke. Elles NE sont PAS dans les migrations versionnées.

### Fix 1 : Table ADMIN_USER manquante (anomalie HIGH smoke)

Créée manuellement avant le scénario admin (S5) :
```sql
CREATE TABLE IF NOT EXISTS ADMIN_USER (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO ADMIN_USER (user_id) VALUES (1460);  -- RecetteAdmin
```

**Action recommandée** : ajouter la DDL à `sql/2026-06-encheres-depouillement.sql` ou créer un fichier dédié.

### Fix 2 : SCORING_CONFIG colonnes manquantes (anomalie MEDIUM smoke)

Appliqué pour faire taire les 500 sur `/api/admin/deadline` (pollue les logs mais non bloquant UX) :
```sql
ALTER TABLE SCORING_CONFIG
  ADD COLUMN deadline_hour INT NULL DEFAULT 11,
  ADD COLUMN early_match_hour INT NULL DEFAULT 9,
  ADD COLUMN early_match_offset_hours INT NULL DEFAULT 3;
```

---

## État après re-smoke (2026-06-11 17:52)

Suite au merge du correctif chantier/04 (commit 13df70a) et au re-smoke :
- Tous les scénarios manquants ont été joués : M2, S2c, S4, S7e, S5c, S6e
- SMOKE OK — aucune anomalie fonctionnelle résiduelle
- AUCTION id=1, league_id=24 : `status=tallied`, `current_round=2` (tour 2 dépouillé)
- Égalité J1/J2 sur player_id=12402 vérifiée en SQL et visuellement (badge "ÉGALITÉ")
- Serveur arrêté après le re-smoke

---

*Environnement préparé le 2026-06-11 par Claude Code. Re-smoke exécuté le 2026-06-11.*
