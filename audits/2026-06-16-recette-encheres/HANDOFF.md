# Handoff recette E2E enchères — faits d'environnement

Environnement préparé et VÉRIFIÉ fonctionnel le 2026-06-16. App buildée
(BRIEF-06 inclus) et démarrée sur http://localhost:3100, base recette isolée
`ligueenc_recette` (Docker MySQL port 3310). La prod n'est jamais touchée.

## Participants (4) et opérateur
| Rôle | Login (champ "Identifiant") | userId | mot de passe |
|---|---|---|---|
| Bidder | Joueur1 | 1461 | recette2026 |
| Bidder | Joueur2 | 1462 | recette2026 |
| Bidder | Joueur3 | 1463 | recette2026 |
| Bidder | Joueur4 | 1464 | recette2026 |
| Opérateur admin (PAS bidder) | RecetteAdmin | 1460 | recette2026 |

Ligue : id **24**, slug `ligue-recette-encheres`, saison `2026-2027` statut AUCTION.
Enchère : budget 130 pts/participant, 13 joueurs/effectif, actuellement
**status=open, current_round=1, 0 mise** (fixture vierge).

## Joueurs disponibles (saison recette)
6 clubs. Les **gardiens se misent par CLUB** (pseudo-joueurs ci-dessous), jamais
les gardiens nommés (toute mise sur un gardien nommé est rejetée).

Pseudo-gardiens de club (position Gardien) :
| ID | Club |
|---|---|
| 12402 | Recette FC |
| 12403 | Fictif Paris |
| 12404 | Mock United |
| 12405 | Test Olympique |
| 12406 | Demo Athletic |
| 12407 | Sandbox City |

Joueurs de champ par club (ID) :
| Club | DEF | MIL | ATT |
|---|---|---|---|
| Recette FC | 12320-12324 | 12325-12328 | 12329-12331 |
| Fictif Paris | 12334-12338 | 12339-12342 | 12343-12345 |
| Mock United | 12348-12352 | 12353-12356 | 12357-12359 |
| Test Olympique | 12362-12366 | 12367-12370 | 12371-12373 |
| Demo Athletic | 12376-12380 | 12381-12384 | 12385-12387 |
| Sandbox City | 12390-12394 | 12395-12398 | 12399-12401 |

(IDs contigus : ex. Recette FC DEF = 12320,12321,12322,12323,12324.)

## Authentification + endpoints (tout en HTTP, jamais de SQL pour jouer)
Helper : `source audits/2026-06-16-recette-encheres/lib-auth.sh`
- `login_user "Joueur1" /tmp/jar-j1.txt` (crée le cookie de session)
- `api_get  <jar> "/api/auction?leagueId=24"`
- `api_post <jar> "/api/auction" '{"leagueId":24,"bids":[{"playerId":12402,"amount":10}]}'`
- `api_get  <jar> "/api/auction/results?leagueId=24&round=1"`

Côté participant :
- **GET** `/api/auction?leagueId=24` : état, budget restant, joueurs acquis, mises du tour.
- **POST** `/api/auction` `{leagueId, bids:[{playerId, amount}]}` : soumet/remplace
  la mise du tour courant. Renvoie `{ok}` ou `{error}`.
- **GET** `/api/auction/results?leagueId=24&round=N` : résultats d'un tour dépouillé.

Côté admin (jar RecetteAdmin) — **POST** `/api/admin/auction` `{action, leagueId, ...}` :
- `set-deadline` `{deadline: ISO8601 | null}`
- `close-round` (open -> closed)
- `resolve-round` (closed -> tallied : applique le règlement)
- `complete-roster` `{userId, playerIds:[...]}` (uniquement en tallied, complétion d'office)
- `close-phase` (tallied -> resolved : fige et écrit les effectifs dans TEAM)
- `open` (rouvre au tour suivant : current_round+1, status=open)
- **GET** `/api/admin/auction?leagueId=24` : console (bids du tour, participants, état effectifs).

## Reset (si besoin de rejouer depuis zéro)
```bash
docker exec ligue-recette-mysql mysql -urecette -precette2026 ligueenc_recette -e \
"DELETE b FROM AUCTION_BID b JOIN AUCTION a ON a.id=b.auction_id WHERE a.league_id=24;
 DELETE r FROM AUCTION_REMOVAL r JOIN AUCTION a ON a.id=r.auction_id WHERE a.league_id=24;
 DELETE FROM TEAM WHERE ID_LEAGUE=24;
 UPDATE AUCTION SET status='open', current_round=1, round_deadline=NULL WHERE league_id=24;"
```

## Vérif effectifs en fin de phase (lecture seule, autorisée)
```bash
docker exec ligue-recette-mysql mysql -urecette -precette2026 ligueenc_recette -e \
"SELECT ID_USER, COUNT(*) FROM TEAM WHERE ID_LEAGUE=24 GROUP BY ID_USER;"
```
