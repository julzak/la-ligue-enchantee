# Vérification runtime avant merge — PR #19 (saisie manuelle) & PR #20 (gestion saisons)

**Date** : 2026-06-25
**Vérificateur** : agent externe (n'a ni écrit ni reviewé le code)
**Environnement** : RECETTE uniquement (MySQL `ligueenc_recette` port 3310, conteneur `ligue-recette-mysql`, app port 3100). **Prod jamais touchée.**
**Base de test** : worktree `verif/1920` = `origin/main` + merge `origin/chantier/11-saisie-manuelle` + merge `origin/chantier/12-gestion-saisons`.

## Mise en place

- Worktree créé, 2 merges effectués. Conflits résolus (triviaux, non fonctionnels) :
  - `PLAN.md` : 2 bullets distincts conservés.
  - `src/app/admin/nouvelle-saison/SeasonManager.tsx` : div fusionnée = classe `flex-wrap` (chantier/12) + bouton « Reprendre cette saison » (chantier/11).
- `npm install` OK, `npm run build` OK (exit 0).
- Migration `sql/BRIEF-11-admin-bid-audit.sql` appliquée sur recette : colonne `AUCTION_BID.admin_entered_by INT NULL` créée et vérifiée. PR #20 = aucune migration.

---

## VÉRIF A — PR #19 SAISIE MANUELLE : **PRÊT À MERGER**

Ligue de recette #24, enchère #1 ramenée à `open` / tour 1 / butoir `2026-06-20 14:00` (passé).

| # | Test | Attendu | Résultat |
|---|------|---------|----------|
| A1 | Participant soumet après butoir | rejet deadline | **PASS** — HTTP 403 « Tour clôturé le 20/06/2026 14:00 — aucune mise acceptée après l'heure butoir. » |
| A2 | Admin saisit 13 joueurs valides pour participant 1461 | accepté malgré butoir, `admin_entered_by`=id admin | **PASS** — HTTP 200, 13 bids `pending`, **`admin_entered_by`=1460 sur les 13** |
| A3 | Admin re-saisit une AUTRE mise même participant/tour | remplace (pas de doublon) | **PASS** — toujours exactement 13 `pending` (pas 26), montant GK passé 5→7 ⇒ remplacement effectif |
| A4 | Admin saisit une mise INVALIDE (2 gardiens) | rejet, **même erreur que le participant** | **PASS** — HTTP 400 admin **=** HTTP 400 participant, message **identique au caractère près** : « Soumission refusée : votre mise contient 2 gardiens (acquis compris). Maximum autorisé : 1… ». 0 bid inséré. |
| A5 | Admin saisit sur tour `tallied` puis `resolved` | rejet | **PASS** — HTTP 400 dans les deux cas (« La saisie manuelle n'est possible que sur un tour ouvert ou clôturé… »), 0 bid inséré |

**Preuve de validation partagée (A4)** : participant (`/api/auction`) et admin (`/api/admin/auction` action `enter-bid-for-user`) appellent tous deux `validateSummerBids()` (src/lib/auction-validation.ts). La seule différence est la garde deadline, absente côté admin (intentionnel). Audit `admin_entered_by` alimenté depuis la session serveur (`auth.session.user.userId`), pas depuis le champ client.

**Nuance** : `validateSummerBids` ne contrôle PAS le total ≤130 ni les 13 joueurs/quotas à la soumission (ils sont appliqués au dépouillement par le moteur). Le « 2 gardiens » est le bon cas d'invalidité partagée à la soumission. Aucune anomalie.

Capture : `A-admin-saisie-mise.png` (bloc « Saisir une mise pour un participant », sous-titre « Contourne l'heure butoir · validation identique à la soumission joueur », Joueur1 = SOUMISE, butoir passé sur tour OUVERT).

---

## VÉRIF B — PR #20 GESTION SAISONS : **ANOMALIE BLOQUANTE**

### Test bed
La recette ne contenait qu'1 saison. Pour rendre le test d'isolation significatif, créées :
- #3 `YY-CONTROL-CLOSED` (CLOSED, palmarès=2, 4 joueurs / 2 clubs / 1 ligue / 3 participants) — saison témoin.
- #4 `ZZ-TEST-SUPPR` (SETUP, 5 joueurs / 2 clubs / 2 ligues / 4 participants) — cible.
- #1 `2026-2027` (AUCTION, courante) — saison réelle.
- En plus : **1032 PLAYER / 19 CLUB / 3 LEAGUE en `ID_SEASON IS NULL`** (données prod du dump, non rattachées à une saison).

Snapshots : `snapshot-avant-B.txt`, `snapshot-apres-reset500.txt`, `snapshot-apres-delete.txt`.

### 🔴 ANOMALIE BLOQUANTE — cascade reset/delete référence 3 tables inexistantes

Premier `POST /api/admin/seasons/reset` sur ZZ-TEST → **HTTP 500**.
Cause confirmée en SQL : `ERROR 1146 Table 'ligueenc_recette.LEAGUE_SCORE' doesn't exist`.

Les cascades de **`src/app/api/admin/seasons/reset/route.ts`** ET **`src/app/api/admin/seasons/route.ts` (DELETE)** exécutent :
```
DELETE FROM LEAGUE_SCORE     WHERE ID_LEAGUE IN (...)
DELETE FROM LEAGUE_SCORE_DAY WHERE ID_LEAGUE IN (...)
DELETE FROM LAST_SCORE       WHERE ID_LEAGUE IN (...)
```
Ces 3 tables **n'existent dans aucun artefact du repo** : absentes du `prisma/schema.prisma` (seul `SCORE` existe, `@@map("SCORE")`), absentes de **tous** les fichiers `sql/`, et **absentes des deux dumps prod** `ligueenc_v3.sql` et `ligueenc_main.sql` (`grep` : aucune occurrence ; seul `CREATE TABLE SCORE` présent).

**Conséquence en prod (déduite, non testée car prod interdite, sévérité ÉLEVÉE)** : toute réinitialisation OU suppression d'une saison ayant ≥1 ligue (le bloc fautif est sous `if (leagueIds.length > 0)`) plantera en 500 sur la même erreur. La fonctionnalité cœur des deux boutons (orange = réinit, rouge = suppr) est inopérante dès qu'une ligue existe.

**Aggravant — non-atomicité** : `CLUB / LEAGUE / LEAGUE_USER / PLAYER` sont **MyISAM** (vérifié). Le `prisma.$transaction` interactif ne peut PAS annuler les DELETE MyISAM déjà exécutés. Au 500, l'ordre de cascade a déjà supprimé `LEAGUE_USER` (étape 5) avant de planter sur `LEAGUE_SCORE` (étape 6). Observé : ZZ-TEST laissé en état corrompu mi-supprimé (league_users=0, mais players/clubs/leagues intacts), **sans rollback possible**. C'est exactement le scénario de demi-suppression catastrophique.

### Vérification de la logique restante (en neutralisant le bug)
Tables-stub vides `LEAGUE_SCORE/LEAGUE_SCORE_DAY/LAST_SCORE` créées en recette pour isoler le défaut « table manquante » du reste de la cascade. Avec les stubs :

| # | Test | Attendu | Résultat |
|---|------|---------|----------|
| B3 | Réinit ZZ-TEST | coquille conservée (id/label/SETUP), 0 enfants | **PASS** — HTTP 200, season #4 survit, 0 club/joueur/ligue/participant |
| B4 | Re-prépa puis Suppr ZZ-TEST | saison disparue, 0 orphelin | **PASS** — HTTP 200, season #4 GONE, 0 orphelin |

### B5 — ISOLATION (le test qui conditionne le merge) : **PASS**

Comparaison stricte AVANT vs APRÈS (reset+delete de ZZ-TEST) :

| Saison / scope | AVANT | APRÈS | Verdict |
|----------------|-------|-------|---------|
| #1 `2026-2027` AUCTION courante | 90 joueurs / 6 clubs / 1 ligue / 4 part. | **identique** | INCHANGÉ |
| #3 `YY-CONTROL-CLOSED` (+palmarès) | 4 / 2 / 1 / 3 part. + **2 palmarès** | **identique** | INCHANGÉ |
| NULL-SEASON (données prod) | 1032 joueurs / 19 clubs / 3 ligues | **identique** | INCHANGÉ |
| PALMARES global | 2 | 2 | INCHANGÉ |

Le delta global (PLAYER −5, CLUB −2, LEAGUE −2, LEAGUE_USER −4 sur le run delete) correspond **exactement** aux seules données de ZZ-TEST. **Aucune autre saison touchée.** Le scoping `ID_SEASON = ?` / `ID_LEAGUE IN (...)` ne matche jamais les lignes `ID_SEASON IS NULL` (NULL `≠` id). Isolation propre.

### B6 — GARDE SETUP-only (anti-catastrophe) : **PASS — robuste**

Appels API directs sur saisons NON-SETUP, tous **rejetés 403 sans aucune mutation** :

| Action | Cible | Résultat |
|--------|-------|----------|
| DELETE | #1 AUCTION courante | **403** « …SETUP et non-courantes… ACTIVE/WINTER/CLOSED est inviolable. » |
| RESET | #1 AUCTION courante | **403** |
| DELETE | #3 CLOSED | **403** |
| RESET | #3 CLOSED | **403** |
| PATCH rename | #3 CLOSED | **403** |

Garde serveur `canMutateSeason()` = `status === "SETUP" && !isCurrent`, évaluée AVANT toute logique de suppression. Compteurs des saisons #1 et #3 re-vérifiés inchangés après les 5 tentatives. Défense en profondeur côté UI confirmée par capture `B-seasons-apres.png` (la saison CLOSED n'expose aucun bouton réinit/suppr, seulement un libellé « clôturée » désactivé).

### B7 — Nettoyage
Saison témoin #3 et ses enfants supprimés, tables-stub `DROP`, enchère #1 restaurée à `resolved`/tour 2, bids `admin_entered_by` de test purgés. État final recette = 1 saison `2026-2027` AUCTION courante (= état initial). Colonne `admin_entered_by` conservée (migration BRIEF-11, voulue). Serveur arrêté.

---

## VERDICTS

### PR #19 — Saisie manuelle : **PRÊT À MERGER**
A1→A5 tous verts. Validation partagée prouvée (erreur identique admin/participant), audit `admin_entered_by` correct, remplacement sans doublon, garde butoir contournée intentionnellement côté admin, garde de statut (tallied/resolved) opérationnelle.

### PR #20 — Gestion saisons : **ANOMALIES — NE PAS MERGER EN L'ÉTAT**

- **Isolation (B5)** : ✅ stricte. Aucune autre saison, ni les données prod NULL-season, ni le palmarès, ni la saison courante #1 ne bougent. Le scoping est correct.
- **Garde SETUP-only (B6)** : ✅ watertight. 403 systématique sur AUCTION/CLOSED/courante, zéro donnée touchée. Le garde-fou anti-catastrophe fonctionne.
- **BLOQUANT** : la cascade reset ET delete référence 3 tables (`LEAGUE_SCORE`, `LEAGUE_SCORE_DAY`, `LAST_SCORE`) **introuvables dans le schéma Prisma, dans les fichiers `sql/`, et dans les deux dumps prod**. ⇒ en prod, réinit/suppr d'une saison avec ≥1 ligue → **HTTP 500** + **état mi-supprimé non rollbackable** (tables MyISAM). Le reste de la logique est correct une fois ces 3 lignes neutralisées.

**Correctif attendu avant merge** (hors scope de cette vérif) : confirmer le vrai nom des tables de scores par ligue (ou qu'elles n'existent pas) et soit les retirer de la cascade, soit utiliser les bons noms, soit garder les DELETE seulement si la table existe. Tant que ce point n'est pas tranché, le merge de #20 expose la prod à des suppressions/réinit qui plantent à mi-course.
