# La Ligue Enchantée — Guide du nouveau site

## Vue d'ensemble

Le nouveau site remplace l'ancien ligueenchantee.com. Toutes les données (joueurs, équipes, scores, classements) sont les mêmes — seule l'interface change.

**3 ligues, 54 participants :** Ligue 1 (Baudens League), Ligue 2, National 1 — 18 participants chacune.

---

## Pour les participants

### Se connecter

Aller sur le site → **Se connecter** avec votre identifiant habituel (pseudo) et mot de passe.

### Consulter les résultats

- **Page d'accueil** : résumé de la journée en cours, meilleurs/pires joueurs, résultats L1, classement interligue
- **Résultats** (onglet dans votre ligue) : classement de la journée, leader, progressions/chutes, résumé IA "Lia"
- **Général** : classement cumulé de la saison
- **Stats** : classement des joueurs L1 par poste (filtre G/D/M/A) et nombre (10/20/50/100)

### Mon équipe

- **Mon équipe** (lien en haut) : voir votre effectif de 13 joueurs
- Choisir vos **11 titulaires** parmi vos 13 en cliquant sur les joueurs
- Respecter les contraintes : 1 GK, 3-5 DEF, 3-5 MIL, 1-3 ATT
- **Valider avant la deadline** (affichée en haut de page)
- Si pas validé à temps : la compo précédente est reconduite

### Coupe Enchantée

- Page dédiée accessible depuis l'accueil
- Bracket complet : préliminaire → seizièmes → huitièmes → quarts → demis → finale
- Règle du Petit Poucet : bonus pour l'équipe moins bien classée

### Enchères (quand le mercato est ouvert)

- Un bandeau doré "Mercato en cours" apparaît sur toutes les pages
- Cliquer dessus pour accéder à la page d'enchères
- Chercher un joueur libre, fixer votre mise, enchérir
- Budget : 130 points par participant, enchères aveugles

---

## Pour les admins

### Saisie des notes (après chaque journée)

1. Aller sur `/admin/notes`
2. Sélectionner la journée
3. Pour chaque joueur ayant joué, saisir :
   - **Note** : la note L'Équipe (1-10)
   - **But** : nombre de buts marqués
   - **Pas** : nombre de passes décisives
   - **CSC** : nombre de buts contre son camp (-2 pts chacun)
   - **🟥** : cocher si carton rouge (note remplacée par 0, bonus conservés)
   - **Pen** : nombre de penalties arrêtés (gardiens uniquement, +2 pts chacun)
4. **Sauvegarder** (brouillon) — l'heure de sauvegarde s'affiche
5. **Publier** quand tout est saisi → recalcule automatiquement tous les classements

### Scoring automatique

| Élément | Points |
|---------|--------|
| Note L'Équipe | 1-10 |
| But (ATT / MIL) | +2 /but |
| But (DEF) | +4 /but |
| But (GK) | +10 /but |
| Passe décisive | +1 /passe |
| CSC | -2 /csc |
| Carton rouge | Note → 0 (bonus conservés) |
| Penalty arrêté (GK) | +2 /pen |
| Non noté / forfait | 2 pts |

### Exceptions à gérer manuellement

- **Penalty raté** : -1 pt → ajuster la note du joueur
- **Carton rouge annulé** : on garde la note à 0
- **Tapis vert** : saisir manuellement 5 pts (gagnant) / 4 pts (perdant) pour chaque joueur

### Gestion des équipes

- `/admin/equipes` : modifier la composition de n'importe quel participant
- Sélectionner la ligue → le participant → "Modifier le 11"

### Jokers

- `/admin/jokers` : échanger un joueur pour un autre dans l'effectif d'un participant
- Nombre de jokers configurable par type et par saison

### Coupe

- `/admin/coupe-france` : gérer le bracket, résoudre les tours, modifier les dates
- Petit Poucet activable (bonus = écart classement ÷ 2)

### Enchères / Mercato d'été

- `/admin/encheres` : ouvrir/fermer les tours, résoudre les enchères, tirage au sort en cas d'égalité
- 130 points de budget, enchères aveugles, joueur attribué au plus offrant
- Égalité : joueur et points remis en jeu au tour suivant
- Les participants enchérissent depuis leur page ligue

### Mercato d'hiver

- `/admin/mercato-hiver` : **à venir**
- Principe : chaque participant reçoit des points proportionnels à son classement (le dernier reçoit le plus)
- Règle : 1 joueur entrant = 1 joueur sortant obligatoire
- Budget et règles à définir par les admins avant l'ouverture

### Paiements

- `/admin/paiements` : cocher qui a payé sa cotisation (30€)
- Suivi du montant collecté

---

## Ce qui a changé vs. l'ancien site

| Fonctionnalité | Avant | Maintenant |
|---|---|---|
| Interface | PHP/HTML basique | Design moderne, responsive mobile |
| Photos joueurs | Pas de photos | Photos pour 99% des joueurs actifs |
| Classement interligue | Limité | Page complète avec tous les participants |
| Saisie des notes | Formulaire basique | Par match, avec logos clubs, sauvegarde auto |
| Bonus buts | +2 pour tous | +2 ATT/MIL, +4 DEF, +10 GK |
| Carton rouge / CSC / Pen | Géré à la main | Cases dédiées dans l'interface admin |
| Coupe | Excel | Bracket interactif sur le site |
| Topo IA "Lia" | N'existait pas | Résumé automatique de chaque journée |
| Compo équipe | Via forum | Page "Mon équipe" avec drag & drop |
| Forum | phpBB | Lien externe (migration prévue) |
| Jokers | Via forum/email | Interface admin dédiée |
| Enchères été | Excel/email | Module intégré avec enchères en ligne |
| Mercato hiver | Excel/email | À venir — points proportionnels au classement |
| Paiements | PayPal manuel | Suivi intégré dans l'admin |

---

## Navigation rapide

| Page | URL |
|------|-----|
| Accueil | `/` |
| Ma ligue | `/ligue/ligue-1` (ou `ligue-2`, `national-1`) |
| Mon équipe | `/ligue/{slug}/mon-equipe` |
| Coupe | `/coupe` |
| Classement interligue | `/classement-interligue` |
| Admin notes | `/admin/notes` |
| Admin équipes | `/admin/equipes` |
| Admin jokers | `/admin/jokers` |
| Admin enchères | `/admin/encheres` |
| Admin coupe | `/admin/coupe-france` |
| Admin paiements | `/admin/paiements` |
| Règlement | `/reglement` |
