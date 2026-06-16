# Rapport de recette simulée — Module Enchères (BRIEF-07)

Date : 2026-06-16
Testeur : agent recette (calcul des attendus exclusivement depuis `docs/regles-encheres.md`, sans lecture du code moteur).
Environnement : app `http://localhost:3100`, base recette `ligueenc_recette` (Docker MySQL :3310), ligue 24, fixture vierge (enchère ouverte, tour 1, 0 mise). Prod jamais touchée.

## VERDICT : NO-GO

Le module ne peut PAS ouvrir les vraies enchères d'août en l'état. Un bug bloquant unique (classification des positions cassée dans le moteur de dépouillement et de validation d'effectif) rend le module inutilisable dès le tour 1 et empêche toute constitution d'effectif valide. La phase ne peut pas être close, rien n'est écrit dans TEAM, le scoring de test n'a pas pu tourner.

Bloquants :
- **BLOQUANT-1** : tous les joueurs de champ (DEF + MIL + ATT) sont comptés comme « milieux » par le moteur. Conséquence : la pénalité « plus de 6 milieux » se déclenche sur toute mise normale (12 joueurs de champ → « 12 milieux misés, max 6 » → retrait de 6 joueurs), et la validation d'effectif voit « 0 DEF, 0 ATT, N MID ». Touche : dépouillement (pénalités de ligne), `complete-roster` (quota MID), `close-phase` (validation effectif).
- **BLOQUANT-2** : au tour N>1, le moteur exige 13 joueurs misés AU TOUR, alors que le règlement (3.1) reporte automatiquement les acquis sans nouvelle mise. Toute mise de complément (1 à quelques joueurs) déclenche « K joueurs misés au lieu de 13 » et retire l'acquisition. Aucun effectif ne peut donc être complété par enchère après le tour 1.

Les deux empêchent de finir la simulation conformément. Mécaniques qui fonctionnent (voir détail) : restitution des points, détection d'égalité, détection de gardien manquant, garde-fous admin (close-phase refuse les effectifs invalides). Le bug est de classification/comptage, pas d'arithmétique de budget.

---

## 1. Scénario

4 participants fictifs (Joueur1=1461, Joueur2=1462, Joueur3=1463, Joueur4=1464), opérateur RecetteAdmin=1460. Mapping des positions vérifié en base (lecture seule), conforme au HANDOFF : Recette FC DEF 12320-24 / MIL 12325-28 / ATT 12329-31 ; idem par club ; pseudo-gardiens 12402-12407.

Cas limites couverts (obligatoires) :
| Cas | Où dans le scénario |
|---|---|
| Égalité de mise sur un joueur | Tour 1 : J1 et J2 misent 30 sur le DEF 12320 |
| Mise sans gardien | Tour 1 : J4 mise 13 joueurs de champ, aucun gardien |
| Excès sur une ligne | Tour 1 : J3 mise 5 attaquants (max 4) |
| Dépassement de budget | Tour 1 : J4 misait initialement 170 (variante écartée) ; retenu Tour 2 : J3 mise 80 alors que son budget effectif est 75 |
| Sous-nombre → complétion d'office | Fin de phase : J4 complété d'office par l'admin |

### Mises Tour 1 (toutes acceptées par POST /api/auction, réponse `{ok:true, "13 enchere(s) placee(s)"}`)

- **J1** (total 130, 1 GK / 5 DEF / 4 MIL / 3 ATT) : GK 12402=10 ; DEF 12320=30, 12321=9, 12322=9, 12323=8, 12324=8 ; MIL 12325=8, 12326=8, 12327=8, 12328=8 ; ATT 12329=8, 12330=8, 12331=8.
- **J2** (total 130, 1 GK / 5 DEF / 4 MIL / 3 ATT) : GK 12403=10 ; DEF 12320=30, 12334=9, 12335=9, 12336=8, 12337=8 ; MIL 12339=8, 12340=8, 12341=8, 12342=8 ; ATT 12343=8, 12344=8, 12345=8.
- **J3** (total 130, 1 GK / 4 DEF / 3 MIL / 5 ATT = excès 1 ATT) : GK 12404=10 ; DEF 12348=10, 12349=10, 12350=5, 12351=5 ; MIL 12353=10, 12354=10, 12355=5 ; ATT 12357=25, 12358=10, 12359=10, 12399=10, 12400=10.
- **J4** (total 130, SANS GARDIEN, 6 DEF / 4 MIL / 3 ATT) : DEF 12362=20, 12363=10, 12364=10, 12365=10, 12366=10, 12376=10 ; MIL 12367=10, 12368=10, 12369=10, 12370=10 ; ATT 12371=5, 12372=5, 12373=10.

### Mises Tour 2 (1 acquisition de complément par participant)

- **J1** : DEF 12377=10 (budget effectif 80).
- **J2** : MIL 12381=10 (budget effectif 80).
- **J3** : ATT 12385=80 — DÉPASSEMENT (budget effectif 75).
- **J4** : GK 12405=30 — pour acquérir son gardien manquant (budget effectif 90).

---

## 2. Résultat ATTENDU (calculé à la main depuis le règlement, AVANT dépouillement)

### Tour 1 attendu

Attribution (3.2.a) : 12320 disputé J1=J2=30 → **égalité, personne ne l'obtient, 30 pts rendus à chacun** (3.2.a + 3.2.b). Tous les autres joueurs sont misés par un seul participant → obtenus au prix misé.

Pénalités de composition (3.2.c), appliquées sur les acquisitions du tour, retrait sur l'acquisition la plus chère (égalité = ordre alphabétique) :
- **J3** : 5 ATT misés (max 4) → retrait de **1 attaquant**, le plus cher de la ligne = **12357 (25)**. J3 garde 12 joueurs.
- **J4** : aucun gardien → retrait de **1 joueur**, le plus cher du tour = **12362 (20)**. J4 garde 12 joueurs, toujours sans gardien.
- **J1, J2** : mises valides, aucune pénalité ; chacun perd 12320 par égalité → 12 joueurs.

Budgets entrant T2 (budget_N+1 = 130 − somme des mises obtenues) :
| | acquis T1 | dépensé | budget T2 |
|---|---|---|---|
| J1 | 12 (GK+5DEF perd 12320+4MIL+3ATT → 11 champ+GK = 12) | 100 | 30 |
| J2 | 12 | 100 | 30 |
| J3 | 12 (perd 12357) | 105 | 25 |
| J4 | 12 (perd 12362) | 110 | 20 |

### Tour 2 attendu

- **J1** : acquiert 12377 à 10 → 13 joueurs, valide. Budget 20.
- **J2** : acquiert 12381 à 10 → 13 joueurs, valide. Budget 20.
- **J3** : mise 80 > budget effectif 75 → pénalité dépassement (3.2.c) → retrait de l'unique acquisition 12385. Reste 12 joueurs, budget 25. (Interprétation : la pénalité « total > 130 » du tableau s'évalue contre le budget EFFECTIF du participant, pas contre 130 en dur, sinon le report de points de 3.2.b serait vidé de sens. Interprétation explicite du testeur.)
- **J4** : acquiert le gardien 12405 à 30 → 13 joueurs, valide. Budget −10 ? Non : budget effectif 20, mise 30 > 20 → MÊME pénalité dépassement attendue → retrait. (Erreur de conception du scénario côté testeur : J4 budget effectif est 20, pas 90. Voir note ci-dessous.) Attendu corrigé : J4 mise 30 > 20 → retrait → reste 12, sans gardien.

> Note sur les budgets effectifs : le scénario a été conçu sur des budgets attendus (J4=20). Le système a renvoyé des budgets RÉELS différents (J4=90) parce que le BLOQUANT-1 lui avait déjà retiré 8 joueurs au T1, lui « rendant » des points. Les attendus T2 sont donc partiellement caducs : l'état réel entrant au T2 était lui-même corrompu par le bug du T1. C'est documenté comme conséquence en cascade, pas comme un cas de test indépendant.

### Fin de phase attendue

Après 2 tours, J4 (et au plus quelques autres) sous 13 joueurs → **complétion d'office** par l'admin avec des joueurs disponibles à **1 pt** chacun (règle 4), jusqu'à un effectif valide 13 (1 GK, 3-6 DEF, 3-6 MIL, 1-4 ATT). Puis close-phase → écriture dans TEAM → scoring de test.

---

## 3. Résultat RÉEL produit par le système

### Tour 1 réel

`resolve-round` → `"24 joueurs attribués, 1 égalité(s) remise(s) en jeu, 0 mises perdues, 26 retrait(s) de pénalité"`.

- Égalité 12320 : status `tie` pour J1 et J2, personne ne l'obtient, 30 pts rendus. **CONFORME.**
- Détection gardien manquant J4 : retrait « Aucun gardien misé : retrait de Baptiste Chevallier (12362, 20), acquisition la plus chère du tour ». **CONFORME** (mécanisme et cible corrects).
- MAIS 26 retraits au lieu de 2 attendus. Pour CHAQUE participant, le moteur applique « 12 milieux misés (max 6) » (J1, J2, J3) ou « 13 milieux misés (max 6) » (J4), retirant 6, 6, 6 et 7 joueurs respectivement, en plus de la pénalité gardien de J4. Les joueurs retirés sont de toutes positions (DEF/MIL/ATT confondus) mais tous étiquetés « milieux ».

Acquisitions réelles finales T1 (au lieu de 12 chacun attendu) :
| | acquis réel | dont | dépensé réel | budget réel T2 |
|---|---|---|---|---|
| J1 | 6 | GK,1 DEF,2 MIL,2 ATT | 50 | 80 |
| J2 | 6 | GK,1 DEF,2 MIL,2 ATT | 50 | 80 |
| J3 | 7 | GK,3 DEF,2 MIL,1 ATT | 55 | 75 |
| J4 | 5 | 1 DEF,2 MIL,2 ATT (sans GK) | 40 | 90 |

Le test de l'excès d'attaquants de J3 est masqué : J3 est pénalisé pour « milieux » avant que la ligne ATT ne soit évaluée correctement.

### Tour 2 réel

`open` → current_round=2, budget reporté correct, myBids vide, 6 acquis reportés (CONFORME). Les 4 mises de complément acceptées à la soumission.

`resolve-round` → `"0 joueurs attribués, ..., 4 retrait(s) de pénalité"`. **Toutes** les acquisitions retirées :
- J1 : « 7 joueurs misés au lieu de 13 » → retrait (BLOQUANT-2 : compte effectif 6+1=7 comme mise du tour).
- J2 : « 7 joueurs misés au lieu de 13 » → retrait.
- J3 : « 7 milieux misés (max 6) » → retrait (BLOQUANT-1 ; masque le test de dépassement budget : on ne saura pas si le dépassement aurait été détecté, la pénalité ligne agit avant).
- J4 : « 6 joueurs misés au lieu de 13 » → le gardien acquis est retiré ; J4 reste sans gardien.

Aucun participant ne progresse. Counts inchangés vs après T1.

### Fin de phase réelle

- `complete-roster` J4 avec 8 joueurs (dont GK) → **erreur** : `"Ajout refusé pour Nicolas Martin : Quota MID atteint (6)"` pour un DÉFENSEUR (12363). BLOQUANT-1 contamine la complétion d'office.
- En ajoutant 1 par 1 : GK 12405 accepté, puis 1 champ (12362) accepté ; tout champ suivant refusé « Quota MID atteint (6) ». J4 plafonne à 7 joueurs.
- `close-phase` → **refus correct** : `"4 effectif(s) invalide(s) — complétez d'office avant de clore la phase"`, avec pour chacun « 0 défenseurs (attendu 3 à 6), 0 attaquants (attendu 1 à 4) » — confirmation que la validation d'effectif voit 0 DEF / 0 ATT (tout classé MID).
- **TEAM reste vide** (`SELECT COUNT(*) FROM TEAM WHERE ID_LEAGUE=24` = 0). Étape « effectifs dans TEAM + scoring de test » NON ATTEIGNABLE à cause des bloquants.

---

## 4. Tableau des divergences

| # | Attendu | Réel | Cause probable | Classe |
|---|---|---|---|---|
| D1 | Pénalités de ligne calculées par position réelle (DEF/MIL/ATT séparées, plafonds 6/6/4) | Tous les joueurs de champ comptés comme « milieux » ; plafond 6 appliqué au total champ ; mises normales charcutées (6-7 retraits/participant) | Classification de position cassée dans le moteur : DEF et ATT mappés/comptés comme MIL. Le mapping en base est correct (vérifié), donc la faute est dans la lecture/normalisation de POSITION côté moteur d'enchères. | **BLOQUANT** |
| D2 | Au tour N>1, seuls les nouveaux joueurs sont misés ; les acquis sont reportés (règle 3.1) ; pénalité « <13 » ne s'applique pas au report | « K joueurs misés au lieu de 13 » sur l'effectif partiel ; toute mise de complément retirée | Le moteur évalue la pénalité « <13 joueurs » sur la mise du tour seule sans tenir compte des acquis reportés | **BLOQUANT** |
| D3 | complete-roster ajoute jusqu'à 13 joueurs valides à 1 pt | Refus « Quota MID atteint (6) » dès le 2e joueur de champ | Même cause que D1 (classification position) appliquée à la validation de quota dans complete-roster | **BLOQUANT** (conséquence de D1, même racine) |
| D4 | close-phase écrit les effectifs valides dans TEAM | close-phase refuse (effectifs jugés invalides : 0 DEF / 0 ATT) ; TEAM vide | Même cause que D1 dans la validation d'effectif | Conséquence en cascade de D1 |
| D5 | Test dépassement budget J3 (T2) déclenche pénalité budget | Non observable : J3 retiré pour « milieux » avant | Masquage par D1 | Test non concluant (à rejouer après fix) |

Mécaniques CONFORMES (non-divergentes) : égalité de mise (12320, personne, points rendus) ; restitution/report des points (budgets réels = 130 − somme des won, arithmétique exacte) ; détection de gardien manquant (J4, cible correcte sur l'acquisition la plus chère) ; report des acquis au tour suivant sans remise ; garde-fou close-phase qui refuse d'écrire un effectif invalide dans TEAM.

---

## 5. Vérification de fin de phase

Non réalisable en l'état : aucun effectif valide n'a pu être constitué (BLOQUANT-1 + BLOQUANT-2), close-phase refuse à juste titre, **TEAM = 0 ligne** pour la ligue 24, donc aucun scoring de test n'a pu tourner. Le garde-fou (refus de clore une phase à effectifs invalides) fonctionne correctement et constitue le seul point positif de cette étape.

À rejouer intégralement après correction des bloquants : compléter chaque effectif à 13 valides, close-phase, vérifier `SELECT ID_USER, COUNT(*) FROM TEAM WHERE ID_LEAGUE=24 GROUP BY ID_USER` = 13 chacun, puis lancer un scoring de journée de test.

---

## 6. Pistes de correction (HORS PÉRIMÈTRE recette — à porter dans PLAN.md ## Blocages)

Le testeur ne corrige rien. Pour le chantier correctif :
1. Racine probable de D1/D3/D4 : la normalisation de la POSITION dans le moteur d'enchères (mapping G/Gardien, DEF, MIL, ATT → catégorie interne). Tous les non-gardiens semblent retomber sur « MID ». À auditer : la fonction qui mappe `PLAYER.POSITION` vers la ligne (DEF/MIL/ATT/GK) côté dépouillement et validation d'effectif.
2. Racine de D2 : la pénalité « moins de 13 joueurs misés » doit compter l'effectif cumulé (acquis reportés + nouvelles mises) et non la seule mise du tour courant.
3. Après fix, rejouer cette recette complète (driver dans `audits/2026-06-16-recette-encheres/driver.sh`, mises ci-dessus) et confirmer zéro divergence avant GO.

---

## Annexes
- Réponses brutes des endpoints et requêtes de vérification : voir transcript ; driver jetable `audits/2026-06-16-recette-encheres/driver.sh`.
- Reset pour rejouer : commande du HANDOFF (`DELETE` bids/removals/TEAM + `UPDATE AUCTION status=open, current_round=1`).
