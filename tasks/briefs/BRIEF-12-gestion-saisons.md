# BRIEF-12 — Gestion des saisons en préparation (renommer / réinitialiser / supprimer)

**Statut** : livré (PR chantier/12-gestion-saisons)
**Périmètre** : admin uniquement, saisons en statut SETUP non-courantes.

---

## Contexte

Les opérations destructives sur une saison (renommage, vidage, suppression) n'existaient pas. Un admin devait supprimer manuellement en SQL. Ce chantier les expose dans l'UI avec des garde-fous stricts pour éviter toute perte accidentelle sur une saison en cours ou clôturée.

---

## Trois fonctions livrées

### 1. Renommer (SAFE)

Aucune donnée détruite. Change uniquement le label d'une saison SETUP.

- Route : `PATCH /api/admin/seasons` — nouveau champ `label` (distinct du champ `status`/`isCurrent` existant)
- Validation serveur : trim, rejet label dupliqué (même code 409 que POST), rejet si status != SETUP ou isCurrent
- UI : bouton "Renommer" sur la ligne SETUP ; input inline avec confirmation Entrée/OK ou annulation Échap

### 2. Réinitialiser

Vide la préparation d'une saison SETUP mais conserve la coquille (id + label + statut SETUP).

- Route : `POST /api/admin/seasons/reset`
- Garde serveur : rejet si status != SETUP ou isCurrent (403 explicite)
- Cascade dans une transaction Prisma (voir section Cascade ci-dessous)
- UI : bouton "Réinitialiser" (orange) sur ligne SETUP, confirmation par re-saisie du label

### 3. Supprimer

Efface la saison SETUP ET ses données de préparation.

- Route : `DELETE /api/admin/seasons`
- Garde serveur : rejet si status != SETUP ou isCurrent (403 explicite)
- Même cascade transactionnelle que le reset, + suppression de la ligne Season elle-même
- UI : bouton "Supprimer" (rouge) sur ligne SETUP, confirmation par re-saisie du label

---

## Garde-fous (non-négociables)

- `canMutateSeason({ status, isCurrent })` : retourne `true` UNIQUEMENT si `status === "SETUP" && !isCurrent`. Les statuts ACTIVE, WINTER, CLOSED → toujours false.
- Vérification côté serveur sur chaque route (reset et delete) : on relit la saison depuis la DB avant d'agir. L'UI ne fait jamais confiance.
- Tout dans une transaction Prisma : un échec partiel ne laisse pas d'orphelins.
- Jamais `palmares`, `season_movement`, ni une autre saison touchée.

---

## Cascade de suppression (ordre FK-sûr)

Les tables suivantes sont supprimées dans cet ordre pour respecter les dépendances de clés étrangères :

| Ordre | Table          | Condition                        | Note                                  |
|-------|----------------|----------------------------------|---------------------------------------|
| 1     | AUCTION_REMOVAL | `auction_id IN (auctions de ces ligues)` | Enfant de AUCTION |
| 2     | AUCTION_BID     | `auction_id IN (auctions de ces ligues)` | Enfant de AUCTION |
| 3     | AUCTION_BUDGET  | `auction_id IN (auctions de ces ligues)` | Enfant de AUCTION |
| 4     | AUCTION         | `league_id IN (ligues de la saison)` | Gérée en raw SQL (pas de modèle Prisma actif) |
| 5     | LEAGUE_USER     | `ID_LEAGUE IN (ligues de la saison)` | Participants |
| 6     | LEAGUE_SCORE    | `ID_LEAGUE IN (ligues de la saison)` | A priori vide en SETUP, inclus par sécurité |
| 7     | LEAGUE_SCORE_DAY | `ID_LEAGUE IN (ligues de la saison)` | Idem |
| 8     | LAST_SCORE      | `ID_LEAGUE IN (ligues de la saison)` | Idem |
| 9     | LEAGUE          | `seasonId = X` | Via Prisma |
| 10    | PLAYER          | `seasonId = X` | Via Prisma |
| 11    | CLUB            | `seasonId = X` | Via Prisma |
| 12    | SEASON          | `id = X` | DELETE uniquement (pas RESET) |

Note : AUCTION, AUCTION_BID, AUCTION_BUDGET, AUCTION_REMOVAL sont gérées en `$queryRawUnsafe` car le schéma Prisma les marque "documentaire uniquement" (migrations manuelles dans sql/).

---

## Tests

Fichier : `src/lib/season-mutation-guard.test.ts` — 13 cas :
- Le seul cas autorisé : SETUP non-courante
- Sanity-check anti-régression CLOSED : le test vérifie explicitement que CLOSED retourne false (si ce test passe en `true`, la logique est brisée)
- Tous les autres statuts (ACTIVE, WINTER, CLOSED, AUCTION) avec/sans isCurrent : toujours false
- SETUP avec isCurrent = true : false

---

## Critères d'acceptation

- [x] `canMutateSeason` testable sans DB, 13 cas vitest
- [x] `PATCH /api/admin/seasons` avec `label` renomme uniquement si SETUP non-courante
- [x] `POST /api/admin/seasons/reset` vide la prépa en transaction, refuse si pas SETUP
- [x] `DELETE /api/admin/seasons` supprime en transaction, refuse si pas SETUP
- [x] Boutons visibles uniquement sur les lignes SETUP et non-courantes
- [x] Confirmation par re-saisie du label pour reset et delete
- [x] `npm run lint` + `npm test` + `tsc --noEmit` + `npm run build` verts
