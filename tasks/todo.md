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
- [x] `scripts/test-season-scoping.ts` : slugs ligues, clés saison, mapping clubs
      par nom + alias TheSportsDB, sanity-check anti-régression (ancien hardcode).
- [x] `docs/mode-emploi-saisons.md` : étape 4 participants + checklist lancement
      + actions post-lancement (sync calendrier, vérif configs).
- [ ] **Recette de bout en bout À FAIRE avant l'été** : créer une saison de test
      complète (stepper 4 étapes + launch) sur une copie locale de la DB (dump +
      mysql local), vérifier la bascule du site, les deadlines, la saisie de
      notes et une publication de journée. NE PAS lancer une saison de test sur
      la prod (le launch bascule le site immédiatement).

## Review session 2026-06-10 (chantiers A-E livrés, déployés en prod)

Commits : c39c3d5 (A fondation), 096bcab (B+C participants+launch), puis D
(dé-hardcodage + migration MATCH_SCHEDULE appliquée en prod) et E (assets par
nom). Build + tests verts, smoke-test prod OK (fallback legacy strictement
identique : aucune saison isCurrent en base aujourd'hui).

Restes à faire (hors périmètre de cette session) :
- [ ] Recette complète du flux de lancement (ci-dessus).
- [ ] `scripts/get-matchday-info.ts` et `scripts/scrape-notes-web.ts` utilisent
      encore le défaut "2025-2026" de `scripts/lib/sportsdb.ts` : à passer sur
      `resolveSeasonKey` lors du chantier effectifs/scraping de la nouvelle saison.
- [ ] MERCATO_CONFIG n'est pas cloné au lancement (saisie admin volontaire).
- [ ] `/api/admin/paiements` GET liste toutes saisons confondues (module
      cotisations explicitement hors scope).
- [ ] Effectifs joueurs toujours MOCK (TheSportsDB premium) : brancher une vraie
      source avant les enchères d'août.
- [ ] Page `/reglement` mentionne "Saison 2025-2026" en dur (contenu éditorial).

## Contraintes
- `.env` local pointe désormais sur la DB OVH via tunnel : lancer
  `ssh -N -L 3307:127.0.0.1:3306 ligue-ovh` avant tout build/test local
  (ancien .env Scaleway sauvegardé dans `.env.bak-scaleway`).
- Migration DDL = acte manuel AVANT push (auto-deploy). La migration
  `sql/2026-06-match-schedule-season.sql` a été appliquée le 2026-06-10.

---

# Module Enchères été (zone à HAUT RISQUE, démarrage août 2026)

Source de vérité : `docs/regles-encheres.md` (à committer, encore untracked).
Contrat de tests obligatoire avant déploiement : 7 scripts test-encheres-*.ts
(cf CLAUDE.md). Vision Julien : le kick-off de saison intègre les enchères
comme étape finale (création → effectifs/photos → ligues/participants →
enchères → équipes constituées).

## État des lieux (constaté le 2026-06-10)

EXISTE déjà (socle réel, jamais utilisé en prod) :
- Tables AUCTION (par ligue, type summer/winter, budget_per_user,
  players_per_user, current_round), AUCTION_BID (round, statuts
  pending/won/lost/tie, player_out_id pour l'hiver), AUCTION_BUDGET (hiver).
- `/api/auction` GET/POST : mise par tour (remplacement), contrôle budget
  (130 - somme des won = report automatique des points non dépensés ✓).
- `/api/admin/auction` : open/next round, close-round, resolve-round
  (plus haute mise gagne, égalité → statut 'tie', personne ne l'obtient ✓),
  resolve-tiebreak (TIRAGE AU SORT : contraire au règlement), close-auction.
- Pages `/ligue/[slug]/encheres` (mise + recherche joueurs libres via
  /api/admin/jokers/free) et `/admin/encheres`.

MANQUE (écarts au règlement) :
1. **Deadline par tour** : fermeture 100% manuelle, aucun timestamp butoir,
   aucun rejet à T+1s (règle 3.1, tolérance zéro).
2. **Pénalités de composition** : AUCUNE (règle 3.2.c : mise sans gardien,
   quotas par ligne, ≠13 joueurs, dépassement 130 pts → retraits sur les
   acquisitions les plus chères, ordre alphabétique en cas d'égalité, par
   ligne pour les excès de ligne, jamais de dette).
3. **Gardien par CLUB** (piège n°1 du CLAUDE.md) : les mises sont par
   player_id, gardiens inclus. Impact scoring (gardien aligné du club).
4. **Exclusion des joueurs déjà attribués** : on peut miser sur un joueur
   déjà won par un autre participant.
5. **Report des acquis dans la mise** : l'UI ne pré-remplit pas les 13 avec
   les joueurs déjà acquis (règle 3.1).
6. **Pont enchères → TEAM** : RIEN ne crée les effectifs en fin de phase
   (seuls les jokers écrivent dans TEAM). Sans ça, pas d'équipes, pas de
   scoring.
7. **Complétion d'office à 1 pt** (règle 4) : non implémentée.
8. **Notifications email** des résultats (règle 3.2.d) : non implémentées.
9. **Tests** : 0 des 7 scripts du contrat.
10. **Tirage au sort** (resolve-tiebreak) : n'existe pas dans le règlement,
    à retirer ou à tracer comme amendement (section 7 du règlement).

Prérequis hors module : effectifs réels + photos (joueurs actuellement MOCK).

## Chantiers (ordre proposé)

- [ ] **E0 — Committer docs/regles-encheres.md** (source de vérité non versionnée !).
- [ ] **E1 — Moteur pur `src/lib/auction-engine.ts`** : attribution, égalités,
      restitution, pénalités/retraits, complétion 1 pt. Zéro dépendance DB,
      testable hors RSC. + les 7 tests du contrat (avec sanity-checks).
- [ ] **E2 — Deadline par tour** : colonne deadline sur AUCTION, rejet serveur
      au timestamp (tolérance 0), compte à rebours UI, message clair.
- [ ] **E3 — Gardien par club** : modélisation + impact scoring (décision archi).
- [ ] **E4 — Soumission conforme** : 13 joueurs dont acquis pré-remplis,
      exclusion des joueurs attribués, avertissements de quota AVANT la
      deadline (la pénalité reste appliquée au dépouillement si ignoré).
- [ ] **E5 — Dépouillement branché sur le moteur** + retraits motivés +
      pont TEAM en fin de phase + complétion d'office.
- [ ] **E6 — Résultats** : page de résultats par tour (acquisitions, budget,
      retraits avec motif) + email automatique.
- [ ] **E7 — Recette** : simulation interne 3-5 participants fictifs sur 2
      tours complets (exigée par CLAUDE.md), chaque divergence loguée.
- [ ] **E8 — Runbook** : le kick-off intègre la phase enchères (remplace
      l'encart « module à venir »).
- [ ] **Prérequis parallèle — effectifs réels + photos**. Architecture décidée
      (2026-06-10, leçon des tentatives 2025-2026, cf mémoire
      photos-joueurs-historique-sources) : UN fournisseur (TheSportsDB premium
      9$), et photos TÉLÉCHARGÉES en local à l'import (modèle logos clubs
      Wikipedia : fiable, zéro CORS, zéro hotlink, résiliation sans risque).
      L'existant 2025-2026 = patchwork 46% hotlinké (409 Sportmonks abandonné
      + 50 TheSportsDB + 13 API-Football) : ne pas reproduire.

      **Modèle FINAL validé par Julien (2026-06-11, v2 après correction de
      chronologie)** : les photos n'ont d'intérêt que pour les joueurs
      SÉLECTIONNÉS dans les équipes, donc elles se récupèrent APRÈS les
      enchères, au lancement. Conséquence :
      - **Listes de joueurs (noms + postes) : football-data.org GRATUIT**
        (seul tier gratuit avec effectifs complets Ligue 1 ; pas de photos,
        on s'en moque à ce stade). Import début juillet, avant les enchères.
        Avatars à initiales pendant toute la phase d'enchères.
      - **Photos : TheSportsDB premium, 1 SEUL mois (~début août → début
        septembre, 9$)**, souscrit AU LANCEMENT : photos des seuls joueurs
        en équipe (~260) + recrues d'août pour les jokers. Résiliation début
        septembre. Mercato d'hiver : à décider en décembre (noms gratuits
        via football-data.org ; photos = re-souscrire 1 mois ou initiales).
      - Géré par un admin « pilote effectifs » (Patreon + carte perso
        remboursée), SANS Julien dans la boucle.
      - ⚠️ **Risque tracé** : 2 fournisseurs = matching par nom entre nos
        joueurs et les photos TheSportsDB, le mode d'échec 2025-2026.
        Mitigation : matching PAR CLUB (30 vs 30, pas global), nom
        normalisé, rapport des non-matchés avec correction manuelle admin.
      - Contrôle qualité photos à la souscription :
        `scripts/diag-thesportsdb-photos.ts` clé premium (mesure free du
        2026-06-10 : 96% sur échantillon biaisé).

      Les briques d'autonomie : LIVRÉES le 2026-06-11 (migration APP_CONFIG
      appliquée en prod). Décision Julien 2026-06-11 : le token
      football-data.org est un SETUP UNIQUE hors runbook (gratuit, permanent,
      pas une étape admin annuelle ; la phase 1bis a été retirée du guide).
      ⚠️ RESTE À FAIRE UNE FOIS : créer le compte gratuit football-data.org
      et poser le token (champ Clé effectifs de Admin → Configuration, ou
      env FOOTBALL_DATA_TOKEN sur le serveur), puis vérifier l'import live.
      - [x] **Brique 0 — provider football-data.org** dans football-api.ts
            (effectifs gratuits noms+postes, token gratuit à l'inscription,
            10 req/min). Devient la source de l'étape 2 du stepper.
      - [x] **Brique 1 — clés API saisies dans l'admin** : champs « Clé
            effectifs (football-data.org) » et « Clé photos (TheSportsDB
            premium) » dans Admin → Configuration, stockées en DB (pas d'env
            var, pas de redéploiement), avec date de saisie + rappel de
            résiliation pour la clé photos. ⚠️ DDL probable (table config
            clé/valeur) = migration manuelle AVANT push.
      - [x] **Brique 2 — « Récupérer les photos des équipes » AU LANCEMENT** :
            bouton admin post-enchères. Pour chaque club : effectif complet
            TheSportsDB (premium), matching club par club avec NOS joueurs
            sélectionnés (nom normalisé), téléchargement local dans
            `public/players/` (gitignoré), PHOTO_URL = fichier local.
            Rapport des non-matchés + saisie manuelle d'une URL photo par
            joueur. Rejouable (complète les manquants).
      - [x] **Brique 3 — recrues d'août** : pendant la fenêtre d'abonnement,
            « Rafraîchir l'effectif d'un club » = ajout INCRÉMENTAL
            (nouveaux joueurs + photos, jamais de suppression). Hors
            fenêtre : ajout manuel via Admin → Joueurs (existe déjà),
            avatar initiales.
- [x] **Sécurité — token Sportmonks** : scripts legacy supprimés du repo
      (2026-06-11). Le token reste dans l'HISTORIQUE git : révocation côté
      compte Sportmonks À FAIRE PAR JULIEN.

## Décisions à valider avec Julien (avant E1)
1. Modélisation gardien par club.
2. Dépouillement : bouton admin après deadline vs cron automatique.
3. Sort du tirage au sort existant.
4. Source des effectifs réels + photos.

---

## HANDOFF TRAITÉ (2026-08-10, PR #41) — Doublons multi-saisons dans l'écran Admin → Joueurs

**Résolu** : recherche scopée saison courante par défaut (logique PR #39), toggle « Inclure les saisons passées » avec badge saison (« archive » pour les fiches legacy sans ID_SEASON), requête extraite dans `src/lib/admin-player-search.ts` + 5 tests vitest. Vérifié sur recette (`ligueenc_p2`) : défaut = 1 Sissoko 2026-2027, toutes saisons = 3 avec badges. Notes : en prod TOUTES les fiches archives sont en `ID_SEASON NULL` (pas un id de saison passée) ; la copie recette est antérieure au transfert de Hein vers Nice (fiche 18457 absente), vérification croisée faite en lecture seule sur la DB prod. Reste (chip spawné, hors scope) : le POSITION legacy (« 3 - Milieu ») retombe sur « Gardien » dans le select d'édition d'une fiche archive, risque d'écrasement silencieux à la sauvegarde.

### Problème (signalé par Thomas, cas « 3 Gauthier Hein »)
La recherche de l'écran Admin → Joueurs (`/admin/joueurs`) renvoie les joueurs de TOUTES les saisons : pour Gauthier Hein, 3 fiches (« 3 - Milieu / METZ » et « 4 - Attaque » = saisons passées ; « Milieu / OGC Nice » = 2026-2027, la seule misable). Les admins croient à des doublons à supprimer. NE JAMAIS SUPPRIMER les fiches des saisons passées : elles portent l'historique des scores.

### Cause
`GET /api/admin/players?search=...` (src/app/api/admin/players/route.ts, bloc search après le bloc `list=clubs`) ne filtre pas par saison. Le même écran a déjà été corrigé pour la liste des CLUBS (PR #39 : scope saison courante via `getCurrentSeason`, fallback legacy si aucune saison courante) : appliquer la même logique à la recherche de joueurs.

### Fix attendu
1. Par défaut, la recherche ne renvoie que les joueurs de la saison courante (`ID_SEASON = saison courante`).
2. Option « toutes saisons » (case à cocher ou toggle dans src/app/admin/joueurs/page.tsx) pour les besoins d'archives, avec badge saison sur chaque ligne dans ce mode.
3. Test de non-régression + vérification sur l'environnement de recette.

### Environnement de vérification
- Copie prod locale : base `ligueenc_p2` dans le conteneur Docker `ligue-recette-mysql` (port 3310), app : `DATABASE_URL="mysql://recette:recette2026@127.0.0.1:3310/ligueenc_p2" NEXTAUTH_SECRET="recette-secret-2026" NEXTAUTH_URL="http://localhost:3100" PORT=3100 npm run start`. Login admin : `Kazu` / `recette2026` (le champ identifiant = pseudo sans le HTML). Hein y existe en 3 exemplaires comme en prod.
- Build avant commit : tunnel DB requis (`ssh -f -N -o ServerAliveInterval=15 -L 3307:127.0.0.1:3306 ligue-ovh`), sinon le prerender échoue.
- Workflow : branche + PR + CI verte + merge (push direct sur main bloqué par hook) ; l'auto-deploy suit le merge (~1 min).

### Hors scope (backlog, ne pas traiter)
- Identité joueur unique inter-saisons (souhait de Pierre « plus simple avec 1 seul joueur ») : chantier structurel, à cadrer séparément.
- Nettoyage des comptes USER en doublon (GeLo 59, Jun, Snake) : après le mercato.
