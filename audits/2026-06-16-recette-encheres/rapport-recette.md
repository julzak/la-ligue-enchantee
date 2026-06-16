# Rapport de recette — Module Enchères (BRIEF-07)

Date : 2026-06-16
Environnement : `http://localhost:3100`, base recette isolée `ligueenc_recette` (Docker MySQL :3310). Prod jamais touchée.
Ligue 24, saison 2026-2027, budget 130 pts, effectif cible 13 joueurs.
Méthode : tout joué en HTTP (login next-auth + endpoints `/api/auction`, `/api/admin/auction`). Attendus calculés à la main depuis `docs/regles-encheres.md` SEUL, avant chaque dépouillement.

Participants : Joueur1 (1461), Joueur2 (1462), Joueur3 (1463), Joueur4 (1464). Opérateur : RecetteAdmin (1460).

---

## Référence joueurs (HANDOFF)
| Club | GK | DEF | MIL | ATT |
|---|---|---|---|---|
| Recette FC | 12402 | 12320-24 | 12325-28 | 12329-31 |
| Fictif Paris | 12403 | 12334-38 | 12339-42 | 12343-45 |
| Mock United | 12404 | 12348-52 | 12353-56 | 12357-59 |
| Test Olympique | 12405 | 12362-66 | 12367-70 | 12371-73 |
| Demo Athletic | 12406 | 12376-80 | 12381-84 | 12385-87 |
| Sandbox City | 12407 | 12390-94 | 12395-98 | 12399-401 |

---

## Couverture des 5 cas obligatoires
| Cas | Où | Participant |
|---|---|---|
| Égalité de mise | Tour 1, joueur 12348 | J2 vs J3 (20 vs 20) |
| Mise sans gardien | Tour 1 | J3 (aucun GK misé) |
| Excès sur une ligne | Tour 1, ligne ATT | J4 (5 ATT misés et gagnés, max 4) |
| Dépassement de budget | Tour 2 | J2 (total misé > budget effectif) |
| Sous-nombre → complétion d'office | Fin de phase | J3 (< 13 après tour 2) |

---

## Probes préalables (comportement API, documentées, non bloquantes)
- Soumission partielle (< 13 bids) : **acceptée** à la soumission, MAIS au dépouillement elle déclenche la pénalité "moins de 13 joueurs misés → retrait d'autant de joueurs que de joueurs manquants" (règle 3.2.c). CONSÉQUENCE MÉTHODE : pour exercer proprement les cas ciblés (sans GK, excès de ligne, budget), chaque mise DOIT contenir exactement 13 enchères, sinon la pénalité "<13" écrase toutes les acquisitions et masque le cas testé. Un premier passage avec mises partielles a été invalidé pour ce motif (défaut de banc d'essai, PAS un bug : le moteur applique correctement 3.2.c). Le scénario ci-dessous utilise des mises à 13 enchères.
- Total des mises > 130 : **accepté** à la soumission, pénalité différée au dépouillement (conforme : seul l'excès de gardiens est rejeté upfront).
- 2 gardiens dans une mise : **rejeté** à la soumission (conforme décision 2026-06-11).
- Montant <= 0 : **rejeté** ("Les mises doivent etre > 0").
- Re-soumission : **remplace** intégralement la mise du tour (sémantique replace).
- OBSERVATION mineure : un même playerId dupliqué dans une seule soumission a été stocké en 2 lignes distinctes (12402@10 et 12402@20). À surveiller, hors des 5 cas requis.

---
## TOUR 1

Chaque mise = exactement 13 enchères (pour ne pas déclencher la pénalité "<13").

### Mises soumises
**J1** (valide, total 70) : GK12402@10 · DEF 12320@5,12321@5,12322@5,12323@5,12324@5 · MIL 12325@5,12326@5,12327@5,12328@5 · ATT 12329@5,12330@5,12331@5
**J2** (total 85, conteste 12348) : GK12403@10 · DEF 12334@5,12335@5,12336@5,12337@5,**12348@20** · MIL 12339@5,12340@5,12341@5,12342@5 · ATT 12343@5,12344@5,12345@5
**J3** (total 83, SANS GARDIEN, conteste 12348) : DEF 12349@5,12350@5,12351@5,12352@5,**12348@20**,12362@5 · MIL 12353@5,12354@5,12355@5,12356@5 · ATT 12357@8,12358@5,12359@5
**J4** (total 95, 5 ATT = excès) : GK12405@10 · DEF 12363@5,12364@5,12365@5,12366@5 · MIL 12367@5,12368@5,12369@5 · ATT 12371@12,12372@11,12373@10,12385@9,12386@8

Seul joueur contesté : **12348** (J2=20 vs J3=20 → égalité).

### ATTENDU calculé à la main (avant dépouillement)
**Attribution 3.2.a** : 12348 → égalité 20/20 → PERSONNE ne l'obtient, 20 rendus à J2 et J3. Tous les autres non contestés → attribués à leur mise.

| Part. | Pénalité | Joueurs gagnés (won) | Retiré | Dépensé | Budget restant |
|---|---|---|---|---|---|
| J1 | aucune (mise valide, 13 gagnés) | **13** | — | 70 | **60** |
| J2 | aucune (perd 12348 à l'égalité) | **12** | — (12348 perdu = égalité, pas retrait) | 65 | **65** |
| J3 | sans GK → retrait 1 = plus chère acquisition = **12357@8** | **11** | 12357 (sans GK) ; 12348 perdu (égalité) | 55 | **75** |
| J4 | excès ATT (5>4) → retrait 1 ATT = plus chère ATT = **12371@12** | **12** | 12371 (excès ATT) | 83 | **47** |


### RÉEL produit (GET /api/auction + /api/auction/results, round 1)
Message moteur : *"Tour 1 dépouillé : 48 joueurs attribués, 1 égalité(s) remise(s) en jeu, 0 mises perdues, 2 retrait(s) de pénalité"*.

| Part. | Won réel | Budget réel | Retrait réel (motif) | Égalité |
|---|---|---|---|---|
| J1 | 13 | 60 | — | — |
| J2 | 12 | 65 | — | perd 12348 (tie, refund 20) |
| J3 | 11 | 75 | 12357 « Aucun gardien misé : ...acquisition la plus chère du tour » (8 pts) | perd 12348 (tie, refund 20) |
| J4 | 12 | 47 | 12371 « 5 attaquants misés (max 4) : ...la plus chère de la ligne » (12 pts) | — |

### Divergences tour 1
**AUCUNE.** Won, budgets, joueur retiré (identité + motif), égalité remise en jeu et remboursements : tout conforme à l'attendu calculé main.

---
## TOUR 2

État d'entrée (budget effectif = 130 − mises gagnées tour 1) : J1 60/won13/needs0 · J2 65/won12/needs1 · J3 75/won11/needs2 · J4 47/won12/needs1.
Note méthode : en tour 2 la soumission ne contient QUE les nouvelles enchères (les acquis sont reportés automatiquement). Le contrôle "total > 130" se mesure sur (dépensé sur acquis) + (nouvelles mises). Probe confirmée : une nouvelle mise dépassant le budget restant est ACCEPTÉE à la soumission, la pénalité est différée au dépouillement.

### Mises soumises (tour 2)
**J1** : aucune nouvelle mise (effectif déjà complet à 13).
**J2** (DÉPASSEMENT BUDGET) : 12338@5 (FP DEF) + 12390@70 (SC DEF). Total engagé = 65 (acquis) + 75 (nouveau) = **140 > 130**.
**J3** (restera sous 13) : 12387@5 (DA ATT). 1 seule nouvelle mise → atteindra 12, manquera le gardien.
**J4** : 12370@5 (TO MIL). Atteint 13, valide.

### ATTENDU calculé à la main (avant dépouillement)
- **J1** : inchangé, 13 joueurs, budget 60.
- **J2** : total des mises 140 > 130 → pénalité "Total > 130" = retrait 1 joueur = acquisition la plus chère DU TOUR = **12390@70**. Garde 12338@5. → won 13 (12+1). Budget = 130 − (65 + 5) = **60**. Le 70 est rendu.
- **J3** : gagne 12387@5 (non contesté), aucune pénalité (mise valide vis-à-vis des plafonds : 0 GK n'est pas une infraction "excès"; "sans gardien" = retrait 1, MAIS il faut une acquisition à retirer). ATTENTION : J3 mise SANS gardien à nouveau → pénalité sans-GK = retrait 1 = la plus chère acquisition du tour = **12387@5**. Donc J3 ne gagne RIEN net ce tour → reste à **11**. Budget = 130 − 55 = **75** (inchangé, le 5 rendu).
- **J4** : gagne 12370@5 → won 13, valide, budget = 130 − (83 + 5) = **42**.

### RÉEL produit (round 2)
Message moteur : *"Tour 2 dépouillé : 1 joueurs attribués, 0 égalité, 0 mises perdues, 3 retrait(s) de pénalité"*.

| Part. | Won réel | Budget réel | Retraits réels (motif) |
|---|---|---|---|
| J1 | 13 | 60 | — |
| J2 | **12** | 65 | (1) 12390@70 « **14 joueurs misés au lieu de 13** : ...plus chère du tour » ; (2) 12338@5 « **Total des mises (75) > budget disponible (65)** : ...plus chère du tour » |
| J3 | 11 | 75 | 12387@5 « Aucun gardien misé : ...plus chère du tour » |
| J4 | 13 | 42 | — |

### Divergences tour 2
| # | Attendu (mon calcul) | Réel | Cause | Catégorie |
|---|---|---|---|---|
| D1 | J2 garde 12338, atteint **13** (1 seule pénalité budget) | J2 perd les 2 nouveaux, reste à **12** (DEUX pénalités : >13 joueurs + budget) | **Erreur de MON attendu.** J2 avait déjà 12 acquis + 2 nouvelles mises = **14 joueurs misés** > 13 → la pénalité "Plus de 13 joueurs misés" (3.2.c) s'ajoute légitimement à la pénalité budget. Le moteur applique correctement les DEUX infractions cumulées (règle 3.2.c, retraits multiples). Le libellé budget mesure (nouvelles mises 75 vs budget restant 65), formulation équivalente à (engagé 140 > 130). | **Écart d'interprétation côté testeur, PAS un bug.** Conforme au règlement. |

Les cas J1, J3, J4 du tour 2 : **aucune divergence**. Le cas "dépassement de budget" est bien exercé et pénalisé (libellé explicite). Note : il s'est doublé d'un cas "plus de 13 joueurs misés", bonus de couverture non prévu mais correct.

---
## FIN DE PHASE — complétion d'office + clôture + écriture TEAM

### Complétion d'office (règle 4, 1 pt/joueur)
Deux participants étaient sous 13 après le tour 2 :
- **J3** : 11 joueurs, 0 gardien → ajout d'office de **GK 12404 (Mock United) + ATT 12357**, à **1 pt chacun**. Budget 75 → 73. Effectif final 13.
- **J2** : 12 joueurs → ajout d'office de **DEF 12338**, à **1 pt**. Budget 65 → 64. Effectif final 13.

Réel API : `"2 joueur(s) ajouté(s) d'office à 1 pt"` (J3), `"1 joueur(s) ajouté(s) d'office à 1 pt"` (J2). Montant 1 pt confirmé dans l'état joueur (12404@1, 12357@1). **Conforme règle 4.**

### close-phase
Réel : `"Phase close : 52 joueurs écrits dans les effectifs (4 participants × 13)"`. Auction `status=resolved`, `phaseClosed=true`.

### Vérification TEAM (SQL lecture seule, autorisé HANDOFF)
- `COUNT(*) par ID_USER` : 1461→13, 1462→13, 1463→13, 1464→13. **52 lignes, 13 par participant.**
- Composition par poste (table TEAM ⋈ PLAYER) :
  - J1/J2/J3 : 1 Gardien · 5 Défense · 4 Milieu · 3 Attaque = 13 ✓ (quotas 1 / 3-6 / 3-6 / 1-4)
  - J4 : 1 Gardien · 4 Défense · 4 Milieu · 4 Attaque = 13 ✓
- GK par club confirmé : effectif J3 contient le pseudo-gardien « Mock United » (12404), pas un gardien nommé.
- Lignes TEAM : DAY_FIRST=1, DAY_LAST=38, IS_SUBS=0 → effectifs valides sur toute la saison, prêts pour le scoring.

### Calcul de scoring de test
La table de scoring journée (`TEAM_DAY`) est VIDE pour la ligue 24 (0 ligne) : c'est attendu. Le scoring nécessite (a) des compositions titulaires par journée — module distinct du module enchères (règle 2.2) — et (b) des notes L'Équipe ingérées. Ni l'un ni l'autre n'est dans le périmètre de la phase d'enchères ni seedé dans la fixture, et il n'existe pas de route HTTP de scoring côté enchères (non listée au HANDOFF, non déclenchable sans sortir du périmètre observé). **Vérification effectuée à la place** : les effectifs sont écrits dans TEAM, valides en quotas, avec GK pseudo-club, sur DAY 1-38 → l'entrée du pipeline de scoring est correctement alimentée par le module enchères. Le calcul de notes lui-même relève du module titulaires/scoring, hors recette enchères.

---
## SYNTHÈSE DES DIVERGENCES

| # | Tour | Description | Catégorie | Statut |
|---|---|---|---|---|
| D1 | 2 | J2 : DEUX pénalités cumulées (>13 joueurs misés + dépassement budget) au lieu d'1 attendue par moi | Écart d'interprétation **côté testeur** | Expliqué : le moteur applique correctement le cumul d'infractions 3.2.c (12 acquis + 2 nouvelles mises = 14 > 13). Pas un bug. |

Aucune autre divergence sur l'ensemble des deux tours + fin de phase.

### Observations secondaires (non bloquantes, hors 5 cas)
- Mise avec playerId dupliqué dans une même soumission : stockée en 2 lignes (probe initiale). À durcir éventuellement (dédup côté API). N'a pas affecté la recette (non rejoué dans le scénario propre).
- `/api/auction/results` refuse l'accès au jar admin (« pas membre de la ligue ») : les résultats se lisent via un jar participant ou la console `/api/admin/auction`. Comportement cohérent (route côté participant), juste à connaître.

---
## VERDICT : **GO**

Les 5 cas obligatoires ont été exercés de bout en bout (UI/API → moteur → DB → TEAM) :
1. **Égalité de mise** (T1, 12348, J2=J3=20) → personne, 20 rendus aux deux. ✓
2. **Mise sans gardien** (T1 et T2, J3) → retrait 1 sur la plus chère acquisition, motif explicite. ✓
3. **Excès de ligne** (T1, J4, 5 ATT) → retrait 1 dans la ligne ATT, la plus chère. ✓
4. **Dépassement de budget** (T2, J2) → pénalité budget appliquée (+ cumul >13 joueurs, correct). ✓
5. **Complétion d'office** (J3, J2) → joueurs ajoutés à 1 pt, effectifs valides écrits dans TEAM. ✓

Zéro divergence non expliquée. La seule divergence (D1) est une erreur de calcul du testeur, le moteur étant conforme au règlement. Report des points, remboursements d'égalité, sélection alphabétique non requise (pas d'égalité de montant sur les retraits ce run), quotas, GK par club : tous conformes à `docs/regles-encheres.md`.

**Recommandation** : GO pour l'ouverture des enchères réelles d'août 2026, sous réserve de traiter les 2 observations secondaires (dédup playerId) en backlog non bloquant.
