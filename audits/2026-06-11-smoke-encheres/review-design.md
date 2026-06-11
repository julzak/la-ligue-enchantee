# Review design : conformité de l'interface enchères aux maquettes Claude Design

**Date** : 2026-06-11
**Reviewer** : externe (ni implémenteur, ni maquetteur)
**Référentiel** : `design_handoff/encheres/` (MiseScreen.dc.html 6 états, AdminConsole.dc.html 4 états, specs FR, briefs-claude-design.md)
**Rendu réel** : captures du smoke E2E `audits/2026-06-11-smoke-encheres/*.png` (participant 375px, admin 1440px)
**Maquettes rendues** : `audits/2026-06-11-smoke-encheres/maquettes/` (screenshots Playwright des .dc.html servis en HTTP, état par état)

---

## Verdict : CONFORME AVEC ÉCARTS

La structure, la hiérarchie, les tokens (or #C8A84B, vert succès, rouge alerte, ambre avertissement), la typographie (Playfair sur "Tour N", "Enchères d'été", "Prêt à dépouiller le tour N") et la primauté du budget (chiffre or géant + dénominateur fixe + barre de progression) sont fidèles aux maquettes sur les deux écrans. La console admin est l'écran le plus fidèle (bandeau d'état, stepper cycle de vie, gating des actions, confirmations destructives).

Deux écarts nouveaux touchent cependant des principes du brief (détail ci-dessous) : l'état bloquant "2 gardiens" (principe 3, avertissements jamais bloquants) et l'incohérence visible du compteur GARDIEN 4/1 rouge face au footer "Composition conforme" vert.

---

## 1. Écarts NOUVEAUX (non déclarés par les implémenteurs)

### Bloquants (trahissent l'intention ou un principe du brief)

**N1. État bloquant rouge "Soumission bloquée" pour 2 gardiens : contredit le principe 3, état absent des maquettes. À ARBITRER.**
- Maquette : aucun état bloquant n'existe. L'état 04 ("Complète, 2 avertissements") traite toutes les violations de composition en bandeau ambre NON bloquant, bouton "Soumettre ma mise" actif, mention "Vous pouvez soumettre malgré ces avertissements" (maquettes/mise-04-p1.png).
- Réel : panneau rouge "Soumission bloquée, composition invalide" + footer rouge "Soumission bloquée, retirez un gardien" + bouton désactivé (capture `08-s2-deuxieme-gardien-bloquant.png`).
- Le brief est explicite : "Les avertissements de règlement préviennent mais ne bloquent jamais". Le message réel cite une "règle du 2026-06-11", donc probablement une décision produit postérieure aux maquettes (le rapport smoke la marque CONFORME au règlement). Légitime peut-être, mais jamais remontée comme écart design : à faire valider par Julien, et si elle est assumée, à rétro-documenter dans le handoff.

**N2. Incohérence visible : compteur GARDIEN "4/1" rouge avec 3 gardiens nommés au roster, et footer "Composition conforme · 13/13 joueurs" vert, simultanément. À INVESTIGUER.**
- Captures `37`, `38`, `39`, `42`, `47` : la ligne GARDIEN affiche 4 entrées avec badge G (dont "Julien Durand", "Thomas Durand", "Hugo Petit", gardiens NOMMÉS) et le compteur "4/1" en rouge, pendant que le footer dit "Composition conforme" en vert et que la soumission passe.
- Double violation : (a) deux signaux contradictoires sur la même page, alors que le brief impose des informations "jamais ambiguës" et que le même dépassement à 2 pseudo-gardiens déclenche, lui, le blocage N1 ; (b) le brief impose "les gardiens sont des entrées par CLUB, jamais des gardiens nommés", or des gardiens nommés sont apparus dans la recherche et ont été misables.
- Possiblement un artefact du seed recette (joueurs de champ étiquetés G en base), mais l'UI le laisse passer sans cohérence : soit le compteur a tort, soit le validateur a tort.

### Gênants

**N3. Bandeau rouge "Soumission refusée" affiché aussi aux participants qui ONT soumis (après dépouillement).**
- Captures `29` (J2, 4 mises soumises puis retirées) et `47` (J1, 6 acquisitions) : en état dépouillé, le haut de page affiche "Soumission refusée. Ce tour est clôturé. Toute soumission est refusée." en rouge, au-dessus des résultats.
- La maquette réserve le rouge au refus (état 05) et donne au participant ayant soumis le bandeau or "dépouillement en attente" (état 06) puis l'écran Résultats (Brief B). Un joueur qui a soumis et lit "Soumission refusée" en rouge peut croire sa mise rejetée : sémantique des couleurs trompeuse.
- Nota : avant dépouillement, la distinction est correcte (bandeau or capture `42` pour J1 ayant soumis, rouge captures `18`/`19` pour ceux sans mise), conforme à la règle M3.

**N4. État vide : les avertissements ambre remplacent le moment d'accueil de la maquette.**
- Maquette état 01 : zéro avertissement, hint Playfair italique "Constituez votre équipe" + "13 joueurs · 130 points · mises fermées", footer neutre "0 / 13 joueurs · complétez votre mise" (maquettes/mise-01-p1.png).
- Réel (captures `01`, `36`, `40`) : dès l'état vide, panneau ambre "Avertissements de composition" ("Aucun gardien dans la mise...", "0 joueurs misés (acquis inclus) au lieu de 13 : retrait d'autant de joueurs que de manquants") + footer ambre "Mise non conforme, soumission autorisée". Le hint "Constituez votre équipe" est marqué PASS dans le rapport smoke mais n'apparaît sur aucune capture.
- L'utilisateur est accueilli par deux pénalités avant d'avoir rien fait : bruit anxiogène, l'avertissement perd sa valeur d'exception (état maquette 04 uniquement).

**N5. Pas d'horodatage de clôture dans le message participant.**
- Maquette état 05 : "Tour clôturé le 12 août à 20:00. Toute soumission est désormais refusée." Le brief demande "Tour clôturé le ... à ...".
- Réel (captures `18`, `19`, `29`) : "Ce tour est clôturé. Toute soumission est refusée.", sans date ni heure.

**N6. "Clore la phase" proposé dès le premier dépouillement.**
- Maquette état 03 (tour 3/5 dépouillé) : étape 4 grisée, "Disponible au dernier tour".
- Réel (captures `25`, `44`) : dès le tour 1 dépouillé, bouton rouge "Clore la phase" actif avec "Action irréversible". Conséquence du "Tour N sans /5" déclaré, mais à traiter en soi : une action destructive de fin de phase est offerte à chaque tour.

### Cosmétiques

**N7. Badge de poste "MID" au lieu de "MIL"** (captures `37`, `47`). Le brief et les maquettes utilisent G / DEF / MIL / ATT ; les en-têtes de section disent bien "MILIEUX" mais le badge dit "MID" (anglicisme, incohérent avec le reste de la page).

**N8. Badge "ÉGALITÉ" en bleu** (captures `47`, `49`). Couleur hors palette (or, crème, rouge, vert) ; le handoff ne définit aucun bleu. Suggestion : traitement neutre crème/steel ou or sombre.

**N9. Stepper −/+ par ligne : noms tronqués à 375px.** Réel : "Gardiens R...", "Romain Bo...", "Julien Dura..." (captures `07`, `37`...). La maquette utilise un champ pts compact (ex "6 pts" + croix) et affiche les noms entiers. Le budget reste lisible (principe respecté) mais la lisibilité des noms en pâtit.

**N10. Horodatage de soumission perdu en état clôturé.** Maquette : footer "Dernière soumission : 12 août à 19:47" (état 05) et "Mise soumise, 12 août à 19:47 · résultats à venir" (état 06). Réel : "Soumission close" / "Mise soumise" sans heure (captures `18`, `42`, `49`). La confirmation horodatée n'existe que tour ouvert (capture `38`, conforme).

**N11. Bouton "Tout copier" affiché alors que le récap copiable est vide** (captures `25`, `45` : "Le récap par participant arrive avec le chantier Résultats (BRIEF-06)"). Bouton mort : à masquer tant que BRIEF-06 n'a pas atterri.

**N12. Bandeau "Erreur chargement" sans aucune explication** (capture `17-s5-admin-no-close-btn.png`, lié à l'anomalie env ADMIN_USER). Contraire à l'esprit "tout est expliqué" ; prévoir un message actionnable.

---

## 2. Écarts DÉJÀ déclarés : vérification

| Écart déclaré | Statut | Preuve |
|---|---|---|
| Filtre par poste absent du drawer | Réel, toujours d'actualité | Placeholder réel "Rechercher par nom ou club" (captures `01`, `37`) vs maquette "Rechercher par nom, club, poste" + chips Tous/G/DEF/MIL/ATT (maquettes/mise-02-p1.png). Aucune capture du drawer ouvert dans le smoke, vérifié via placeholder. |
| Avatars sans couleur par poste | Réel, impact faible | Les avatars réels sont gris uniforme ; nota : les avatars de la maquette MiseScreen sont eux aussi gris à initiales, l'écart vient donc de la spec texte, pas du visuel maquette. |
| Sélecteur de ligue conservé | Réel, toujours d'actualité | Capture `14` ("Sélectionner une ligue") et `15`. |
| Pas d'horodatage des soumissions admin | Réel, toujours d'actualité | Captures `15`, `35` : badges SOUMISE/EN ATTENTE sans heure ; maquette : 18:02, 18:14... (maquettes/admin-01-p1.png). |
| "Tour N" sans "/5" | Réel, toujours d'actualité (admin) | Réel "Tour 1", "Tour 2" ; maquette "Tour 3 / 5". Côté participant la maquette n'affiche pas non plus de "/5", donc écart admin uniquement. Voir aussi N6 (conséquence aggravée). |
| Récap copiable désactivé (BRIEF-06) | Réel, toujours d'actualité | Captures `25`, `45`. Voir N11 (bouton "Tout copier" orphelin). |
| Écran terminal ajouté | Réel | État pré-phase "Démarrer les enchères" + "Aucune enchère d'été pour cette ligue" (capture `17`), absent des maquettes mais cohérent avec le design system. |

---

## 3. Couverture des états

**Participant (6 états maquette)** : 01 vide OK (avec écart N4), 02 saisie OK (drawer non capturé), 03 complète conforme OK (capture `38`), 04 avertissements partiellement vérifié (bandeau ambre + footer ambre OK captures `06`/`09`, mais l'en-tête budget en DÉPASSEMENT, "−11 dépassement / 130 pts" en rouge dans la maquette, n'apparaît sur aucune capture : non vérifié), 05 lecture seule OK (avec écart N5), 06 awaiting OK (capture `42`, bandeau or + sablier conforme).

**Admin (4+1 états)** : pré-phase OK (état ajouté), ouvert OK (capture `15`/`35`), clôturé OK (capture `41`, fidèle : pill TOUR CLÔTURÉ, "Prêt à dépouiller le tour N" Playfair, encart ambre participants sans soumission, bouton rouge + "Action irréversible, confirmation requise"), dépouillé OK (captures `25`/`44`/`45`, tableau participant/acquisitions/retraits-égalités/budget avec motifs en français lisibles, conformes), **clôture de phase (état 04, complétion d'office) : non joué par le smoke, non vérifiable**.

**Non couvert par cette review** : ResultScreen / Page de résultats (Brief B) ; le smoke n'exerce que la section inline "RÉSULTATS DU TOUR N" de la page de mise.

**Points de vigilance hors verdict** : capture `40` (J2 juste après soumission API) montre 0/13 et budget plein alors que la soumission a réussi en SQL ; probablement un screenshot pris avant rechargement (l'hydratation a été prouvée pour J1, capture `39`), à confirmer.

---

## 4. Synthèse pour arbitrage

1. **N1** (blocage 2 gardiens) : confirmer que la "règle du 2026-06-11" est bien une décision produit validée par Julien ; si oui, amender le handoff (principe 3 prend une exception), si non, repasser en avertissement ambre.
2. **N2** (4/1 rouge vs "Composition conforme") : investiguer données vs logique avant la prod ; les deux signaux ne peuvent pas être vrais en même temps.
3. **N3, N4, N5, N6** : corrections d'écart raisonnables avant ouverture aux 20 participants (N3 et N4 touchent directement la confiance du participant).
4. **N7 à N12** : backlog cosmétique, peut suivre.
