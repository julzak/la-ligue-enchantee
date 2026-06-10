# Sélecteur de journée sur /mon-equipe

## Contexte
- Aujourd'hui `mon-equipe/page.tsx:48` charge en dur `nextDay = currentDay + 1` et `MonEquipeContent.tsx:182` envoie `day: currentDay + 1` en POST.
- L'utilisateur ne peut donc valider sa lineup que sur **la journée à venir**.
- Conséquence : depuis le commit 120e293 le backend autorise la modif des joueurs des clubs concernés par un match reporté sur la journée d'origine (J26 dans l'exemple Pierre Berthet) — mais l'UI ne permet pas d'y accéder.
- Pierre Berthet (mais aussi le besoin "préparer un suspendu sur 2 journées en avance") demandent un sélecteur de journée.

## Approche choisie : query-string `?day=N` (option A, pas de refetch ajax)
- Cohérent avec le modèle existant : `/admin/equipes/[userId]/page.tsx:13-19` utilise déjà `searchParams.day`.
- Page reload Next.js classique → tout reste en server component pour le fetch initial → zéro nouvel endpoint à créer.
- `getParticipantTeam(leagueId, userId, day)` accepte déjà n'importe quel `day` (vu dans `src/lib/db.ts`).
- Refetch ajax (option B) = surdimensionné pour un changement rare (1 fois par session).

## Plan d'implémentation

### 1. `src/app/ligue/[slug]/mon-equipe/page.tsx`
- [ ] Récupérer `searchParams` (Promise) avec param optionnel `day`.
- [ ] Calculer `selectedDay`:
  - si `searchParams.day` est numérique et dans [1, 38] → l'utiliser
  - sinon → fallback `currentDay + 1` (comportement actuel)
- [ ] Charger `team = getParticipantTeam(leagueId, userId, selectedDay)` au lieu de `nextDay`.
- [ ] Charger `lastDayScores` toujours sur `currentDay` (laisser le résumé "dernière journée" inchangé, c'est une référence fixe).
- [ ] Charger la lineup déjà sauvegardée pour `selectedDay` (via `prisma.teamDay.findMany` ou helper) → passer la liste des `playerId` titulaires en prop pour pré-cocher.
- [ ] Charger l'**état "lock"** par club pour `selectedDay` côté serveur, pour pouvoir griser les joueurs non modifiables. Je réutilise la logique existante de `lineup/route.ts:103-152` en l'extrayant dans un helper `src/lib/db.ts:getLockedClubs(day)` qui retourne `Set<string>` (noms de clubs en uppercase). Le helper est partagé entre `lineup` POST et `mon-equipe` page.
- [ ] Passer `selectedDay` + `lockedClubs` (sérialisé en `string[]`) au `MonEquipeContent`.

### 2. `src/app/ligue/[slug]/mon-equipe/MonEquipeContent.tsx`
- [ ] Nouvelle prop `selectedDay: number` (remplace l'usage de `currentDay + 1`).
- [ ] Nouvelle prop `lockedClubs: string[]`.
- [ ] Remplacer `currentDay + 1` par `selectedDay` dans :
  - le payload POST (`day: selectedDay`)
  - le label header ("Composition pour la journée X")
  - le message de save success
- [ ] Ajouter un sélecteur en haut (à côté du titre) : flèches `←` `→` + label `J{selectedDay}`. Le clic met à jour `?day=N` via `useRouter().push(...)` (page reload server, état OK).
- [ ] Bornage du sélecteur : pas avant `1`, pas au-delà de `currentDay + 2` (laisse 2 journées en avance, suffit pour le cas suspendu 2 matchs).
- [ ] Bouton retour rapide "Journée actuelle" si `selectedDay !== currentDay + 1`.
- [ ] Pour chaque joueur affiché, si son club appartient à `lockedClubs` → bouton désactivé (pointer-events-none, opacité réduite, tooltip "Match déjà joué" via `title`).
- [ ] Garder le résumé "Résumé dernière journée (J{currentDay})" tel quel — c'est une **info fixe**, pas liée au sélecteur.

### 3. Helper partagé `src/lib/db.ts`
- [ ] Extraire la logique de calcul des `lockedClubs` de `lineup/route.ts:103-152` dans un helper `getLockedClubs(day: number): Promise<Set<string>>`.
- [ ] Refacto `lineup/route.ts` POST pour appeler ce helper au lieu d'inline.
- [ ] Couvre la logique des matches reportés : `is_postponed=1 AND home_score IS NULL AND admin_override_date IS NULL` → match exclu → clubs non lockés.

### 4. Tests manuels (avant commit)
- [ ] J actuelle + 1 (cas nominal) : comportement identique à avant.
- [ ] J actuelle + 2 : on peut sélectionner et sauver, deadline pas passée.
- [ ] J passée sans match reporté : tous les joueurs grisés, save refusée 403.
- [ ] J passée AVEC match reporté en cours : seuls les joueurs des 2 clubs concernés sont éditables. Save accepte la modif sur ces joueurs uniquement.
- [ ] Joueur grisé : bouton non cliquable visuellement, état `starterIds` non modifié au clic.
- [ ] Borne basse : `?day=0` ou négatif → fallback `currentDay + 1`.
- [ ] Borne haute : `?day=99` → fallback `currentDay + 1`.

### 5. Doc
- [ ] Pas de modif `/admin/guide` : c'est côté user, pas admin.
- [ ] Mini message Telegram WhatsApp à préparer pour les joueurs (à valider avec Julien).

## Effets de bord identifiés
- Le helper `getLockedClubs` extrait change la signature interne mais pas le comportement de `/api/lineup` POST → couvert par les tests.
- Si une lineup pour la journée sélectionnée n'existe pas encore en DB (jamais sauvée), le fallback "lineup précédente" du backend marche déjà. Côté UI on devra cocher les `isStarter` selon ce qui revient de `getParticipantTeam` qui gère déjà ce cas (à vérifier).
- Aucun impact base de données, aucune migration.

## Questions ouvertes pour validation
1. **Borne haute du sélecteur** : `currentDay + 2` suffit pour le cas suspendu, ou tu préfères ouvrir jusqu'à `currentDay + 5` (préparation de coupe / vacances) ?
2. **Borne basse** : la première journée (`day = 1`), ou borner à la dernière journée publiée + reportée non joué ?
3. **Sélecteur** : flèches `←/→` ou dropdown numéroté `J1` à `J38` ? Flèches plus simples, dropdown plus rapide pour aller chercher J5.

## Estimation
1h30 - 2h dev, 30min tests manuels.

---

# Machine à saisons — Interseason

Objectif : cycle de vie complet d'une saison de bout en bout, pour que l'admin
n'ait plus jamais de saisie manuelle massive chaque été. Toute bascule annuelle
= opérations de données en quelques clics dans l'admin, zéro DDL, zéro CLI.

## Décisions verrouillées (validées avec Julien)

- **DB = MySQL** (le brief disait Postgres/Supabase : faux pour ce projet).
- **PK = Int autoincrement** + style legacy `@map("UPPER_CASE")` comme tout le schéma.
- **seasonId nullable, historique intact** : les Club/Player/League existants
  restent à `seasonId NULL`, on ne backfill pas la prod 20 ans.
- **Migration** : 1 seul DDL one-shot (additif, nullable) appliqué via
  `prisma migrate deploy` après relecture. Ensuite plus jamais de DDL :
  toute la machine à saisons = server actions transactionnelles dans l'admin.
- Seul CLI restant : import one-shot du palmarès historique (CSV).
- **Hors scope** : cotisations/paiements (on ne touche pas).
- Vocabulaire positions Ligue = FR plein : "Gardien","Défense","Milieu","Attaque"
  (mapping API GK/DEF/MID/ATT -> ces 4 valeurs, éditable par l'admin).

## État des lieux (constaté dans le code)

- Schéma legacy : `CLUB`, `PLAYER`, `LEAGUE`, `SCORE`, `STATS_USER`, `TEAM`,
  `TEAM_DAY`, `USER`... PK `Int @db.UnsignedInt`.
- Aucun scoping saison aujourd'hui. `League` = `name` + `firstYear` (pas de
  divisionLabel/tier). `Club` = id/idClubEq/name. `Player` = clubId/position(str).
- Tokens design : night, surface, surface-2, gold #C8A84B, gold-dim, rouge.
- Admin : 14 sections existantes, pas de `nouvelle-saison`.

---

## CHANTIER 1 — Modèle de données Season  [FAIT, migration en attente d'application]

- [x] `model Season` (table `SEASON`, PK Int) + relations.
- [x] `enum SeasonStatus` { SETUP, AUCTION, ACTIVE, WINTER, CLOSED }.
- [x] `model Palmares` (table `PALMARES`, PK Int) + relation Season.
- [x] `League` : + seasonId/divisionLabel/tier. `Club`/`Player` : + seasonId (nullable).
- [x] Migration SQL écrite : `sql/2026-05-machine-saisons.sql` (NON appliquée).
- [x] `prisma validate` + `tsc` + `npm run build` OK.
- [x] **GATE relecture** : SQL relu par Claude.ai = SÛR sous réserve de 3 vérifs
      serveur (moteur InnoDB, colonnes AFTER, PK INT UNSIGNED). Vérifs ajoutées en
      tête du .sql. Verdict consigné dans `sql/RELECTURE-machine-saisons.md`.
- [ ] **GATE application** : lancer les 3 vérifs sur le serveur OVH puis appliquer
      le .sql (dev local n'a pas accès TCP/3306). Tant que non appliqué, pas de test runtime.

## CHANTIER 2 — Écran admin "Démarrer une nouvelle saison"  [FAIT, build OK]

Page `/admin/nouvelle-saison` — stepper 3 étapes. Convention repo = pages client
+ routes `/api/admin/*` (pas server actions), suivie.

- [x] `src/lib/football-api.ts` : abstraction provider, cible **TheSportsDB**
      (gratuit, L1 id 4334), env `FOOTBALL_API_PROVIDER`/`FOOTBALL_API_MOCK`/
      `THESPORTSDB_KEY`, mock déterministe (18 clubs + effectifs). `.env.example` créé.
- [x] API : `/api/admin/seasons` (GET/POST/PATCH), `.../clubs`, `.../squad`,
      `.../import`, `.../leagues` (GET prefill + POST). Auth `isAdminAuthenticated`.
- [x] Étape 1 : label → POST seasons (SETUP).
- [x] Étape 2 : récup clubs + checkbox ; "Charger l'effectif" par club ; position
      éditable (select FR) ; "Importer en base" → Club+Player avec seasonId (transaction).
- [x] Étape 3 : ligues divisionLabel+tier configurables ; prefill depuis saison N-1.
- [x] Lien nav admin ajouté. `npm run build` OK.
- [ ] **Vérif runtime** : bloquée tant que la migration (gate chantier 1) n'est pas
      appliquée sur une DB joignable. À faire après application.

## CHANTIER 3 — Palmarès automatique  [FAIT, build OK]

- [x] `scripts/import-palmares.ts` (one-shot) : parse CSV (annee, division,
      position, pseudo), crée Season CLOSED par année, remplit PALMARES. Idempotent.
- [x] Clôture (`src/lib/season-close.ts` + `POST /api/admin/seasons/close`) : lit
      les classements finaux (somme STATS_USER.ptsTot via getLeagueStandings), fige
      podiums 1/2/3 + Vainqueur/Finaliste Coupe (dérivé du match Finale CUP_MATCH),
      écrit PALMARES. Transactionnel + idempotent (delete+recreate). Passe la saison
      en CLOSED.
- [x] Page publique `/palmares` réécrite : source = table PALMARES + fallback
      legacy (`palmares-legacy.ts`, données verbatim de l'ancienne page) via
      `src/lib/palmares.ts` (dédup year+division+position). Group by saison, podium
      par division + coupe, tableau d'honneur recalculé. Tokens dark existants.
- [ ] Vérif runtime : bloquée tant que migration non appliquée (gate chantier 1).

## CHANTIER 4 — Montées / descentes automatiques  [FAIT, testé]

- [x] Calcul à la clôture : 3 premiers montent (tier-1), 3 derniers descendent
      (tier+1), bornes min/max tier respectées, montée prioritaire en petite ligue.
      Logique pure dans `src/lib/season-movement.ts` (sans dépendance, testable).
- [x] Persistance : table SEASON_MOVEMENT (ajoutée à la migration + schema.prisma)
      + enum MovementType. Remplie par closeSeason.
- [x] Override admin : `PATCH /api/admin/seasons/movements` (toTier + type),
      UI dans SeasonManager (sélecteur type + tier cible, flag "modifié").
- [x] Pré-remplissage étape 3 chantier 2 : `GET /api/admin/seasons/leagues`
      renvoie déjà le prefill structure (mapping participants via mouvements = next).
- [x] **Test** `scripts/test-saison-mouvements.ts` : 12 cas + sanity-check borne
      haute. PASSE. (Le test importe `season-movement.ts` pur, pas `db.ts`.)
- [ ] Vérif runtime : bloquée tant que migration non appliquée (gate chantier 1).

## Fichiers livrés (chantiers 3+4)
- `src/lib/season-movement.ts` (calcul pur), `src/lib/season-close.ts` (clôture)
- `src/lib/palmares.ts` (lecture DB+legacy), `src/lib/palmares-legacy.ts` (fallback)
- `src/app/api/admin/seasons/{close,movements}/route.ts`
- `src/app/palmares/page.tsx` (réécrite), `src/app/admin/nouvelle-saison/SeasonManager.tsx`
- `scripts/import-palmares.ts`, `scripts/test-saison-mouvements.ts`
- schema.prisma + sql : + SEASON_MOVEMENT + enum MovementType

---

## Ordre & gates d'acceptation

1. Chantier 1 (schéma + migration relue) → acceptation Julien sur le SQL.
2. Chantier 2 (écran + mock) → acceptation fonctionnelle.
3. Chantier 3 (palmarès).
4. Chantier 4 (montées/descentes).

## Review (à remplir en fin)

---

# Lancement de saison — rendre l'app "season-aware" (session 2026-06-10)

Objectif : que le bouton "Démarrer la saison" fonctionne vraiment. Aujourd'hui le
stepper crée Season/clubs/joueurs/ligues en base, mais le site public ignore
totalement la notion de saison : lancer 2026-2027 ne changerait RIEN à l'affichage
(pire : doublons de ligues et de joueurs partout).

## État des lieux (constaté dans le code le 2026-06-10)

Ce qui existe et marche :
- Stepper 3 étapes `/admin/nouvelle-saison` : création SETUP → import clubs+joueurs (seasonId) → ligues (seasonId).
- Machine à états SeasonManager : SETUP→AUCTION→ACTIVE (isCurrent)→WINTER→CLOSED + clôture palmarès.
- Saison 2026 (id 1) clôturée, ligues 19/20/22 rattachées.

Ce qui manque (bloquant pour un vrai lancement) :
1. `db.ts getLeagues()` (l.102) : prend TOUTES les ligues id>0, slugs codés en dur
   sur les noms legacy ("baudens"→ligue-1, "national"→national-1, sinon ligue-2).
   Les nouvelles ligues s'ajouteraient aux anciennes avec des slugs en collision.
2. Caches clubs/joueurs (`db.ts` l.8-21) : `findMany()` sans filtre saison → doublons.
3. `getCurrentMatchday()` (l.145) = max(SCORE.day) global → resterait bloqué à 38.
4. Aucune étape "participants" : personne n'inscrit les users dans les nouvelles
   ligues (LEAGUE_USER, PK leagueId+userId). Ligues par affinité → prefill copie N-1.
5. ~12 hardcodes `'2025-2026'` : SCORING_CONFIG (db.ts, scoring-config.ts, deadline),
   JOKER_CONFIG (x4), PAYMENT, CUP, URL TheSportsDB `s=2025-2026` (deadline route +
   scripts sync). Aucune row config n'est créée pour la nouvelle saison.
6. MATCH_SCHEDULE : pas de colonne season → le calendrier 2025-2026 resterait en place.
7. `assets.ts` : logos/shortnames/teamName→clubId mappés sur les IDs numériques des
   clubs 2025-2026. Les clubs réimportés ont de NOUVEAUX ids → logos et deadlines cassés.

Hors scope (chantiers séparés) : module enchères (remplit TEAM), effectifs réels
(mock TheSportsDB), multi-pseudos, perf desktop.

## Architecture retenue (à valider)

Helper central `src/lib/season.ts` : `getCurrentSeason()` (react cache) basé sur
`Season.isCurrent`. Règle de scoping avec fallback legacy ZÉRO RISQUE pour la prod
actuelle :
- ligues : `where seasonId = current.id` ; si la saison courante n'a aucune ligue
  scopée → comportement actuel (id>0). Slug = slugify(name) + table de correspondance
  legacy conservée pour les 3 ligues actuelles.
- clubs/joueurs : `where seasonId = current.id` ; si 0 row (cas 2026 actuel, données
  legacy seasonId NULL) → unscoped comme aujourd'hui.
- `getCurrentMatchday()` : max(day) des SCORE des joueurs de la saison courante,
  fallback global si pas de joueurs scopés. Nouvelle saison sans scores → J1.

## Chantiers

### A — Fondation season-aware (cœur)
- [ ] `src/lib/season.ts` : getCurrentSeason / getCurrentSeasonLabel (+ version
      non-cache pour scripts CLI).
- [ ] Scoper getLeagues (+slug dérivé), caches clubs/joueurs, getCurrentMatchday.
- [ ] Vérif : build + site identique à aujourd'hui (aucune saison scopée courante).

### B — Stepper étape 4 : participants
- [ ] `GET/POST /api/admin/seasons/participants` : prefill par affinité (mapping
      tier→tier depuis la saison N-1, via LEAGUE_USER des anciennes ligues),
      création des LEAGUE_USER des nouvelles ligues. Idempotent.
- [ ] UI étape 4 : liste par ligue, ajout/retrait d'un user, compteur.

### C — Lancement : bouton "Démarrer la saison" robuste
- [ ] `POST /api/admin/seasons/launch` transactionnel : checklist de readiness
      (≥1 ligue, ≥1 club, ≥1 joueur, participants dans chaque ligue, SCORING_CONFIG
      + JOKER_CONFIG créés pour le label — copiés depuis la saison N-1 si absents),
      puis status ACTIVE + isCurrent (une seule courante).
- [ ] UI SeasonManager : affiche la checklist ✓/✗ avant lancement, bloque si rouge.

### D — Dé-hardcodage '2025-2026'
- [ ] Remplacer les ~12 occurrences par getCurrentSeasonLabel().
- [ ] Saison TheSportsDB dérivée du label (format imposé "YYYY-YYYY" à l'étape 1
      du stepper : validation ajoutée).
- [ ] MATCH_SCHEDULE : décision Julien — colonne `season` additive (mini DDL,
      historique conservé, recommandé) OU purge du calendrier au lancement.

### E — assets.ts par nom de club
- [ ] Logos/shortnames/teamNameToClubId keyés par nom normalisé (stable entre
      saisons) au lieu de l'id numérique. Lookup id→name via cache clubs.

### F — Doc + tests + recette
- [ ] `scripts/test-season-scoping.ts` : fallback legacy (saison sans données scopées
      = comportement actuel) + scoping effectif (saison avec données) + sanity-check.
- [ ] `docs/mode-emploi-saisons.md` : étape 4 participants + checklist lancement.
- [ ] Recette : créer une saison de test complète en local/préprod, la lancer,
      vérifier bascule du site, puis la supprimer (ou flag de test).

## Contraintes
- `.env` local pointe encore l'IP Scaleway morte (51.15.205.26) : à corriger vers
  la DB OVH avant tout test runtime local (ou tests via SSH ligue-ovh).
- Migration DDL éventuelle (MATCH_SCHEDULE.season) = acte manuel AVANT push (auto-deploy).

## Review (à remplir en fin)
