# Briefs Claude Design — Module Enchères d'été

Trois écrans à maquetter dans Claude Design. Préambule à donner en début de session, puis un brief par écran (un projet ou un canvas par écran). Livrable attendu : un handoff bundle par écran, committé ensuite dans `design_handoff/encheres/` pour les agents d'implémentation (BRIEF-02/04/05/06) et la review design.

---

## Préambule de session (à coller en premier)

Produit : La Ligue Enchantée (ligueenchantee.com), ligue de fantasy football entre ~20 amis, 20 ans d'historique, tout en français. Ton : chaleureux mais légèrement solennel, une "vieille institution" entre potes. Les enchères d'été sont LE rituel fondateur de la saison : chaque participant constitue son équipe de 13 joueurs par mises fermées sur 4-5 tours, avec un budget de 130 points.

Design system existant (à respecter strictement, il est dans le codebase) :
- Thème sombre : fond `night`, cartes `surface` / `surface-2`
- Or `#C8A84B` (accent principal, prestige), or sombre `#8A7133`
- Crème `paper #F5F2EB` / `paper-dim #E8E4DB` (texte sur sombre, aplats clairs)
- Rouge `#C0392B` (alerte, rejet), vert `#1A6B3C` (succès, validation)
- Typo : Inter (corps, données), Playfair Display (titres, moments solennels)
- Radius 8px (12px pour les grandes cartes)

Principes non négociables :
1. Le budget restant et les chiffres de mise sont l'information reine : toujours lisibles, jamais ambigus.
2. Aucune disparition silencieuse : tout ce qui est verrouillé ou rejeté est visible et expliqué.
3. Les avertissements de règlement préviennent mais ne bloquent jamais (le règlement pénalise, il n'interdit pas).
4. Mobile-first pour les écrans participants (375px : les mises se font au téléphone), desktop pour l'admin (1440px).

---

## Brief A — Page de mise (participant, mobile-first)

Job : un participant soumet sa mise du tour en moins de 5 minutes depuis son téléphone, en confiance totale sur son budget.

Structure :
- En-tête : "Tour N", heure butoir avec compte à rebours (ou la mention "clôture manuelle par l'admin" si pas de butoir), et le BUDGET RESTANT en très gros, qui se décompte en direct à la saisie.
- La mise = 13 emplacements. Les joueurs déjà acquis aux tours précédents sont pré-remplis, verrouillés, avec leur prix d'acquisition et un badge "Acquis". Les emplacements libres se remplissent par recherche.
- Recherche d'un joueur libre : nom, club, poste (G / DEF / MIL / ATT), avatar à initiales. Les gardiens sont des entrées par CLUB ("Gardiens Marseille"), jamais des gardiens nommés. Les joueurs déjà attribués à un autre participant n'apparaissent pas.
- Saisie de la mise en points entiers par joueur.
- Avertissements de composition, bandeau ambre NON bloquant citant la pénalité : pas de gardien ("retrait d'1 joueur au dépouillement"), plus de 6 défenseurs / 6 milieux / 4 attaquants, moins ou plus de 13 joueurs, total au-dessus du budget. On peut soumettre quand même.
- Soumettre remplace la mise précédente du tour. Confirmation visible avec horodatage ("Mise enregistrée le … à …").

États à maquetter : (1) premier tour vide, (2) en cours de saisie avec acquis pré-remplis, (3) complète et conforme, (4) complète avec 2 avertissements, (5) après le butoir : lecture seule, message "Tour clôturé le … à …, soumission refusée", (6) tour clôturé en attente de dépouillement.

## Brief B — Résultats du tour (participant, mobile-first)

Job : après le dépouillement, un participant comprend en 30 secondes ce qu'il a gagné, perdu, et avec quel budget il repart.

Structure :
- Sélecteur de tour (T1, T2, …), état par défaut = dernier tour dépouillé.
- Mes acquisitions : joueur, club, poste, prix payé. Moment de satisfaction : c'est ici que Playfair et l'or peuvent briller.
- Mes mises perdues, avec la raison pour chacune : "surenchéri (obtenu par X à Y pts)" ou "égalité : personne, remis en jeu au tour suivant" (points rendus).
- Mes retraits de pénalité, le cas échéant, avec le motif complet en français ("5 attaquants misés : retrait de Mbappé, acquisition la plus chère de la ligne").
- Budget restant pour le tour suivant, en évidence.
- Le dépouillement de tous : tableau de transparence, qui a obtenu quels joueurs et à quel prix (visible UNIQUEMENT après dépouillement, jamais avant).
- Progression de mon effectif : X/13, avec les quotas par ligne.

États : (1) tour dépouillé avec acquisitions + 1 retrait, (2) tour dépouillé sans aucune acquisition (état encourageant, pas une page vide), (3) tour clôturé en attente de dépouillement ("les mises sont fermées, résultats bientôt"), (4) fin de phase : effectif 13/13 complet, moment célébratoire.

## Brief C — Console admin enchères (desktop)

Job : l'admin pilote un tour de bout en bout sans douter de l'état du système, et envoie les résultats par email en un copier-coller.

Structure :
- Bandeau d'état : phase en cours, tour courant, butoir éventuel, compteur de soumissions reçues (14/20) avec la liste de qui manque.
- Actions de cycle de vie, dans l'ordre du flux : Ouvrir un tour (avec champ butoir optionnel, modifiable tant que le tour est ouvert) → Clôturer le tour → Dépouiller → (dernier tour) Clore la phase. Les actions destructives (clôturer, dépouiller) demandent confirmation. L'état courant rend évidentes les actions possibles et grise les autres.
- Résultats du dépouillement : tableau par participant (acquisitions, budget restant, retraits avec motif, égalités remises en jeu).
- RÉCAP COPIABLE : pour chaque participant, un bloc texte brut prêt à coller dans un email, avec un bouton "Copier" (et un "Tout copier"). C'est central : la notification email est envoyée MANUELLEMENT par les modérateurs (décision de règlement).
- Clore la phase : si des participants ont moins de 13 joueurs, liste + interface de complétion d'office à 1 point (joueurs disponibles proposés), puis confirmation "les effectifs sont constitués".

États : (1) tour ouvert avec soumissions en cours, (2) tour clôturé prêt à dépouiller, (3) résultats dépouillés avec récap copiable, (4) clôture de phase avec complétion d'office.

---

## Consignes de fin de session Claude Design

Pour chaque écran validé, demander le handoff bundle pour Claude Code (spec des composants, tokens utilisés, hiérarchie, assets) et me le transmettre : il sera committé dans `design_handoff/encheres/<ecran>/` et servira de contrat aux agents d'implémentation et au design reviewer.
