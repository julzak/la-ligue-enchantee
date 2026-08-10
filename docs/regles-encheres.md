# Règles d'enchères : La Ligue Enchantée

Source de vérité pour le module enchères. Toute modification du règlement doit passer par ce fichier en premier, le code suit. Toute incohérence entre ce fichier et le code = bug à corriger dans le code (sauf si une décision explicite a été prise et tracée dans ce fichier).

Dernière révision : mai 2026, en vue du démarrage août 2026.

## 1. Principe général

Les équipes sont constituées avant le démarrage du championnat de Ligue 1 par des enchères fermées sur plusieurs tours. Chaque participant dispose d'un budget initial de **130 points** à répartir comme il le souhaite sur les joueurs qu'il convoite.

Le jeu démarre courant juillet. Les enchères se déroulent sur 4 à 5 tours successifs, espacés de quelques jours, jusqu'à ce que chaque participant ait constitué un effectif complet de 13 joueurs.

## 2. Composition de l'effectif

### 2.1 Effectif final (13 joueurs)

Chaque équipe doit comporter exactement 13 joueurs respectant les quotas suivants :
- 1 gardien (exactement)
- Entre 3 et 6 défenseurs
- Entre 3 et 6 milieux
- Entre 1 et 4 attaquants

Le gardien est désigné par son CLUB et non par son identité personnelle. Exemple à stocker : `gardiens_marseille`. Si le gardien titulaire est absent, le remplaçant aligné par le club rapporte des points.

La classification (DEF / MIL / ATT) suit celle de l'explorateur de la Ligue Enchantée. Si un joueur n'est pas dans l'explorateur, la classification se base sur sa fiche L'Équipe (lequipe.fr).

### 2.2 Composition titulaires (11 joueurs par journée)

Lors de chaque journée, le participant aligne 11 titulaires parmi ses 13 joueurs :
- 1 gardien (exactement)
- Au moins 3 défenseurs
- Au moins 3 milieux
- Entre 1 et 3 attaquants

La composition titulaires est validée par un module distinct du module enchères.

## 3. Déroulement d'un tour d'enchères

### 3.1 Soumission

À chaque tour, chaque participant soumet une mise pour 13 joueurs (incluant les joueurs déjà acquis aux tours précédents, qui sont automatiquement reportés sans nouvelle mise). La répartition des points est libre, avec un total maximum de 130 points.

Garde-fou ferme à la soumission (décision du 2026-08-10, voir §7) : la plateforme REFUSE toute soumission qui dépasse 13 joueurs (acquis conservés + mise), dépasse le budget restant (points des acquisitions déduits, report des mises perdues et égalités inclus), ou dépasse un maximum de ligne (1 gardien, 6 défenseurs, 6 milieux, 4 attaquants, acquis compris). Les minima de ligne (3 défenseurs, 3 milieux, 1 attaquant) et la mise incomplète (<13 joueurs) restent autorisés à la soumission : un effectif se construit progressivement, ils ne sont exigibles qu'en fin de phase.

La date et heure butoir sont annoncées avant chaque tour. Le timestamp serveur de soumission fait foi. Une soumission reçue après la deadline, même d'1 seconde, est rejetée. Aucune tolérance, aucun report sur le tour suivant.

### 3.2 Dépouillement

Le dépouillement applique les règles suivantes dans l'ordre :

**a) Attribution des joueurs**

Pour chaque joueur misé :
- Si un seul participant a misé sur ce joueur, il l'obtient au prix de sa mise.
- Si plusieurs participants ont misé, le participant ayant la mise la plus élevée l'obtient.
- En cas d'égalité de mise maximale entre plusieurs participants, **personne n'obtient le joueur**. Le joueur est remis en jeu au tour suivant. Les points misés sont rendus à tous les participants concernés.

**b) Restitution des points**

Les points misés sur des joueurs non obtenus (ni pour cause de mise insuffisante, ni pour cause d'égalité) sont récupérés et disponibles au tour suivant. Le budget effectif d'un participant au tour N+1 est donc :

```
budget_N+1 = budget_N - (somme des mises sur joueurs obtenus au tour N)
```

**c) Pénalités de composition**

Si la mise soumise est invalide selon les règles ci-dessous, des retraits sont appliqués sur les acquisitions du tour AVANT validation finale.

Note (2026-08-10) : depuis le garde-fou ferme à la soumission (§3.1), les infractions « plus de 13 joueurs », « dépassement de budget » et « maxima de ligne » ne peuvent plus atteindre le dépouillement via la plateforme. Le tableau reste la référence pour les mises antérieures au garde-fou et comme filet de sécurité du moteur.

| Infraction | Pénalité |
|---|---|
| Absence de gardien dans la mise | Retrait de 1 joueur |
| Plus de 6 défenseurs misés | Retrait du nombre de défenseurs en excès parmi les acquisitions |
| Plus de 6 milieux misés | Retrait du nombre de milieux en excès parmi les acquisitions |
| Plus de 4 attaquants misés | Retrait du nombre d'attaquants en excès parmi les acquisitions |
| Moins de 13 joueurs misés | Retrait d'autant de joueurs que de joueurs manquants |
| Plus de 13 joueurs misés | Retrait d'autant de joueurs que de joueurs en excès |
| Total des mises supérieur à 130 points | Retrait de 1 joueur |
| Total des mises inférieur à 130 points | Aucune pénalité (mais perte sèche pour le participant) |

**Sélection du joueur à retirer en cas de pénalité :**
1. Le retrait porte toujours sur l'acquisition la plus élevée (en points misés) du tour.
2. En cas d'égalité de mise sur les acquisitions maximales, le joueur retiré est désigné par ordre alphabétique (nom de famille).
3. Pour les pénalités par ligne (DEF / MIL / ATT en excès), le retrait porte sur les acquisitions de la ligne concernée, suivant les mêmes critères.
4. Si la pénalité demande de retirer N joueurs mais que le participant n'en a obtenu que M < N au tour, on retire M joueurs. Aucune dette n'est portée au tour suivant.

**d) Notification**

Les résultats du tour sont notifiés à chaque participant par email ET consultables sur la plateforme : liste des acquisitions, budget restant, retraits appliqués (avec motif).

## 4. Fin de la phase d'enchères

La phase se termine quand tous les participants ont atteint 13 joueurs valides dans leur effectif. Si un participant termine le dernier tour avec moins de 13 joueurs (cas extrême après pénalités cumulées), son équipe est complétée d'office par l'administrateur de la ligue avec des joueurs disponibles, au prix unitaire de 1 point chacun.

## 5. Mercato d'hiver (rappel hors scope août)

Le mercato d'hiver utilise un mécanisme différent : budget inversement proportionnel au classement à la journée 19, avec un seul tour d'enchères et un nombre limité de transferts. À implémenter dans un module séparé du mercato d'été. Spec détaillée à produire avant décembre 2026.

## 6. Différences avec le règlement papier historique

| Point | Règlement papier | Nouvelle plateforme |
|---|---|---|
| Soumission | Fichier Excel envoyé par email | Formulaire web sur la plateforme |
| Heure butoir | Heure de l'email faisant foi | Timestamp serveur de soumission |
| Dépouillement | Manuel par l'admin | Automatisé après deadline |
| Notification | Email par l'admin | Email automatique + consultation plateforme |

Le règlement historique complet (toutes sections, pas seulement enchères) est transcrit dans l'app : `src/app/reglement/page.tsx`, accessible en prod sur `/reglement`. Le PDF papier d'origine est perdu (ancien hébergement Vercel retiré, aucune copie sur le VPS OVH au 2026-05-24).

## 7. Décisions et amendements

À tenir à jour. Toute décision prise pour clarifier ou amender le règlement doit être tracée ici.

| Date | Décision | Justification |
|---|---|---|
| 2026-06-10 | Le gardien par club est modélisé comme un pseudo-joueur « Gardiens [Club] » (1 par club, position Gardien). Mises, effectifs et compositions pointent ce pseudo-joueur ; sa note de journée est celle du gardien aligné par le club. | Aucune refonte du pipeline de scoring existant. |
| 2026-06-10 | La fermeture d'un tour est une action admin (bouton « Clôturer le tour »). Une heure butoir peut être annoncée et renseignée : si elle l'est, toute soumission postérieure est rejetée (tolérance 0) ; la fermeture manuelle ferme dans tous les cas. | Premier démarrage sous contrôle humain, la deadline automatique seule n'est pas un impératif (décision Julien). |
| 2026-06-10 | Pas de tirage au sort des égalités (retiré du code, il n'a jamais figuré au règlement). Égalité = personne (règle 3.2.a), et complétion d'office à 1 pt en fin de phase (règle 4). | L'aléatoire est invérifiable et source de litiges. |
| 2026-06-11 | Notification des résultats (règle 3.2.d) : résultats consultables sur la plateforme ; l'email est envoyé MANUELLEMENT par les administrateurs/modérateurs à leurs joueurs, à partir du récap fourni par la plateforme. Pas d'email automatique. | L'app n'a aucune infra email ; pour ~20 participants l'envoi manuel par les modérateurs suffit (décision Julien). |
| 2026-06-11 | Si deux gardiens du même club ont une note le même jour (changement en cours de match), le pseudo-joueur « Gardiens [Club] » reçoit la MEILLEURE des notes ; à égalité de note, le plus grand nombre de buts, puis le plus petit identifiant. | Cas absent du règlement papier. Choix favorable au participant, déterministe et vérifiable (décision Julien, implémenté dans src/lib/club-goalkeeper.ts). |
| 2026-06-11 | Une mise ne peut pas contenir plus d'un gardien (acquis compris) : la soumission est REFUSÉE. Seul cas de rejet pour motif de composition ; toutes les autres infractions de composition restent des pénalités appliquées au dépouillement. | Aucune pénalité du tableau 3.2.c ne couvre l'excès de gardiens ; un effectif final à 2 gardiens serait invalide sans remède (décision Julien). |
| 2026-08-10 | Garde-fou ferme à la soumission : refus (participant ET saisie admin) si acquis conservés + joueurs de la mise > 13, si le total de la mise dépasse le budget restant (acquisitions déduites, report des mises perdues/égalités inclus), ou si un maximum de ligne est dépassé acquis compris (GK > 1, DEF > 6, MIL > 6, ATT > 4). Les minima de ligne (≥3 DEF, ≥3 MIL, ≥1 ATT) et la mise incomplète restent des avertissements non bloquants, exigibles seulement en fin de phase. Les mises en attente non conformes au moment du déploiement restent valides (pas d'effet rétroactif) ; les admins peuvent demander une re-soumission. | L'acceptation des mises non conformes (pénalité au dépouillement) datait du monde asynchrone/xls ; sur la plateforme le refus immédiat évite des pénalités subies. Décision Julien après le cas réel « 14 joueurs / 131 pts » du tour 1 L2, amendée le même jour pour rendre les maxima de ligne également bloquants. Pas de changement stratégique : le règlement comptait déjà les misés (acquis inclus). |
| 2026-08-10 | Visibilité des mises : PENDANT les tours, seules les acquisitions sont publiques (le battu voit qui a obtenu le joueur et à quel prix ; le vainqueur ne voit pas qui il a battu). À la CLÔTURE de la phase d'enchères, dépouillement intégral public : toutes les mises de tous les tours (noms, montants, issues), consultables dans l'onglet Résultats (« grand déballage »). | Révéler les mises perdues en cours de phase renseignerait chacun sur les cibles et budgets des autres pour les tours suivants ; en fin de phase l'information n'a plus de valeur stratégique, seulement une valeur de chambrage (décision Julien, demande de Laurent). |
