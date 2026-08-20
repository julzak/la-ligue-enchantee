# Kick-off nouvelle saison : mode d'emploi pas à pas

Tout se fait depuis l'admin du site, dans l'ordre des phases ci-dessous.
Les phases 1 à 5 sont rejouables sans risque ; seule la phase 6 (« Démarrer
la saison ») bascule le site public, et elle ne se fait qu'une fois. En cas
de message d'erreur inattendu : capture d'écran sur le groupe admins, rien
n'est jamais cassé définitivement.

---

## Phase 0 : préalables (état des lieux)

**Qui : n'importe quel admin, 2 minutes.**

- Aller sur **Admin → Nouvelle saison**.
- Dans « Saisons existantes », vérifier que la saison passée est bien marquée
  **clôturée** (bouton grisé « Saison 2026 clôturée »). C'est déjà fait pour
  2026 : son palmarès est figé et visible sur la page publique `/palmares`.
- Si une saison apparaît encore en ACTIVE ou WINTER (saison finie sur le
  terrain mais pas finie côté site) : cliquer sur son bouton rouge
  **« Clôturer la saison XXX »** et confirmer. Ça fige le palmarès (podiums
  de chaque ligue + vainqueur et finaliste de la coupe), c'est rejouable sans
  risque, et la page `/palmares` se met à jour immédiatement. À ne faire
  qu'une fois la dernière journée jouée et les notes saisies.

**À savoir avant de commencer :**

- **Comptes des services externes.** La Ligue utilise deux services tiers pour
  les joueurs : **football-data.org** (listes de joueurs, gratuit) et
  **TheSportsDB premium** (photos, ~9 $/mois). On les utilise via un **compte
  dédié à la Ligue Enchantée** — **jamais les identifiants personnels** d'un
  admin ni de qui que ce soit. Un admin détient ce(s) compte(s) et colle les
  clés API dans **Admin → Configuration**, section « Effectifs & photos ». La
  clé effectifs se renseigne une fois (gratuite, stable) ; la clé photos est à
  **renouveler chaque été** (l'abonnement est repris à chaque saison, donc la
  clé change). Tout passe par ce champ : personne n'a à transmettre de
  credentials en dehors du site.
- **Calendrier d'été** : préparation (phases 1 à 4) début juillet. On
  **démarre la saison vers la mi-juillet** (phase 6) : c'est ce qui la rend
  « courante » et **ouvre l'accès des participants à leurs enchères**. Les
  **enchères se jouent ensuite de la mi-juillet à la mi-août** (phase 7) et
  constituent les équipes. La première journée de Ligue 1 est autour du
  **23 août**. Pendant les enchères, les joueurs n'ont pas de photo (avatar à
  initiales) : c'est voulu, les photos ne sont récupérées qu'une fois les
  équipes constituées (phase 8).
- Conséquence assumée : dès le démarrage (mi-juillet), le site public pointe
  la nouvelle saison, avec classements et équipes vides jusqu'à ce que les
  enchères les remplissent. C'est normal.
- Les écrans « clé photos », « récupérer les photos des équipes » et
  « rafraîchir l'effectif d'un club » décrits plus bas arrivent avec la mise
  à jour de fin juin.

---

## Phase 1 : créer la saison

**Qui : un admin.**

- Page **Admin → Nouvelle saison**, partie basse, étape 1 du stepper.
- Saisir le libellé : **`2027`** (ou `2026-2027`, les deux marchent).
  Ce format est obligatoire : il sert à retrouver le calendrier de la
  Ligue 1 et les réglages de la saison.
- Cliquer sur **Créer la saison**.

**Vérification :** le stepper passe à l'étape 2 et la saison apparaît dans
« Saisons existantes » avec le statut `SETUP`.

---

## Phase 2 : importer les clubs et les joueurs

**Qui : un admin. Comptez 10-15 minutes.**

- **Pré-requis** : la **« Clé effectifs »** (token football-data.org) doit être
  renseignée dans **Admin → Configuration**. Normalement déjà en place d'une
  saison sur l'autre ; sinon, un admin crée le compte gratuit dédié à la Ligue
  et y colle le token. Sans cette clé, la récupération des clubs/joueurs ne
  remonte rien (ou des données simulées).
- Étape 2 du stepper : cliquer sur **Récupérer les clubs de Ligue 1**.
- La liste des 18 clubs de Ligue 1 s'affiche, tous cochés.
- Pour chaque club : cliquer sur **Charger l'effectif**.
- Contrôler le **poste** de chaque joueur (Gardien / Défense / Milieu /
  Attaque) : le menu déroulant est modifiable et c'est la classification de
  la Ligue qui fait foi, pas celle de l'API (qui est parfois approximative,
  surtout sur les milieux offensifs et les pistons).
- Cliquer sur **Importer en base**.

**Vérification :** le message « X clubs et Y joueurs importés » s'affiche.
Dans « Saisons existantes », la ligne de la saison affiche les compteurs de
clubs et joueurs.

**Notes :**
- L'import est rejouable sans danger : re-cliquer **remplace** l'import
  précédent (pas de doublons). Si vous avez oublié un club, recommencez
  l'étape en entier (re-cocher les clubs, recharger les effectifs, ré-importer).
- Club absent de la liste (promu manquant, club fantaisie type Légion
  étrangère) : à signaler sur le groupe admins, l'ajout manuel d'un club
  n'est pas encore dans l'admin.

---

## Phase 3 : créer les ligues

**Qui : un admin, 2 minutes.**

- Étape 3 du stepper : cliquer sur **Reprendre depuis 2026** (ça recopie la
  structure de l'an dernier) ou sur **Pré-remplir 3 ligues (Ligue 1/2/3)**.
- Les ligues sont **par affinité** : mêmes ligues, mêmes noms qu'avant.
- S'il y a assez de participants pour ouvrir une 4e ligue : **« + Ajouter
  une ligue »**, lui donner un nom et un label de division.
- Le « tier » sert uniquement à l'ordre d'affichage (1 = en haut).
- Cliquer sur **Créer les ligues**.

**Vérification :** le message « Ligues créées » et le bouton vers l'étape
suivante apparaissent.

**Note :** rejouable, mais re-sauver les ligues **remplace** les ligues de la
saison ET efface les inscriptions de participants déjà faites dessus : si vous
repassez par ici après la phase 4, refaites la phase 4 derrière.

---

## Phase 4 : inscrire les participants

**Qui : un admin, avec la liste des inscrits de la saison validée entre vous.**

- Étape 4 du stepper : cliquer sur **Reprendre les participants de 2026** :
  chaque ligue se pré-remplit avec ses participants de l'an dernier.
- Ajuster :
  - retirer ceux qui arrêtent (croix sur le nom),
  - ajouter les nouveaux via le menu déroulant de la ligue concernée.
  - Un participant ne peut être que dans **une seule** ligue : l'ajouter
    quelque part le retire automatiquement d'ailleurs.
- Cliquer sur **Enregistrer les participants**.

**Vérification :** le message « X participants inscrits » s'affiche, et le
compteur par ligue correspond à votre liste.

**Nouveau participant sans compte ?** S'il n'apparaît pas dans le menu
déroulant :
- aller dans **Admin → Utilisateurs**, section « Créer un compte
  participant » : saisir son pseudo (c'est avec ça qu'il se connectera) et
  son email,
- revenir à l'étape 4 et cliquer sur **« Actualiser la liste des comptes »** :
  il apparaît dans le menu déroulant,
- lui communiquer son pseudo et le mot de passe initial **`ligue`**, qu'il
  changera à sa première connexion (page Mon compte).

---

## Phase 5 : revue avant lancement (point de rendez-vous)

**Qui : tous les admins, ensemble.**

- Dans « Saisons existantes », cliquer sur **Ouvrir les enchères** (la saison
  passe en `AUCTION`). C'est encore sans effet sur le site public. Attention :
  ce bouton ne fait que préparer le statut ; le **déroulé réel des enchères**
  (les tours de mises) se fait en phase 7, une fois la saison démarrée.
- Passer en revue, à plusieurs :
  - les compteurs de la saison (ligues, clubs, joueurs),
  - la répartition des participants par ligue,
  - **Admin → Configuration** : notez les valeurs actuelles du barème et des
    jokers, elles seront recopiées pour la nouvelle saison au lancement.
- Tant que vous êtes en phase 5, les **participants** restent ajustables
  (étape 4 du stepper). Pour retoucher les clubs, joueurs ou ligues, c'est
  bloqué à ce stade : cliquer sur **« Revenir en préparation »** sur la ligne
  de la saison, refaire l'étape voulue, puis re-cliquer **« Ouvrir les
  enchères »**.
- Bonus recommandé : cliquer dès maintenant sur **« Synchroniser le
  calendrier »** (ligne de la saison). Si le calendrier de la Ligue 1 est déjà
  publié, autant l'avoir tôt ; sinon le message vous dira de réessayer plus
  tard, sans conséquence.

**STOP ici tant que tout le monde n'a pas validé.** La phase 6 rend la saison
courante et fait pointer le site public dessus.

---

## Phase 6 : démarrer la saison (la rendre courante)

**Qui : un admin, prévenir les autres juste avant. Vers la mi-juillet.**

- Deux chemins équivalents, au choix :
  - **étape 6 « Lancement » du stepper** (partie basse de la page) : la
    checklist de readiness s'affiche directement, avec le bouton **Lancer la
    saison** ;
  - ou dans « Saisons existantes », cliquer sur **Démarrer la saison**.
- Le système vérifie d'abord une **checklist** : ligues créées, clubs et
  joueurs importés, participants dans chaque ligue, libellé exploitable.
  - Si quelque chose manque : **rien n'est lancé**, la liste s'affiche avec
    ✓ et ✗. Corrigez le point en ✗ (la checklist indique l'étape du stepper
    concernée) puis re-cliquez.
  - Si tout est bon : la saison passe en `ACTIVE`, devient la saison
    **courante**, et les réglages (barème de scoring, jokers) sont créés
    automatiquement en copiant ceux de l'an dernier.
- À partir de cet instant, tout le site pointe la nouvelle saison **et les
  participants peuvent accéder à leurs enchères** (c'est ce qui débloque la
  phase 7). Les équipes et les classements sont **vides jusqu'à ce que les
  enchères les remplissent** : c'est normal.

**Vérification immédiate (5 minutes, à plusieurs) :**
- La page d'accueil et les 3 pages de ligues s'affichent sans erreur.
- Classements et « mon équipe » vides : **normal**, les enchères n'ont pas
  encore eu lieu.
- Chaque admin se connecte et vérifie qu'il voit bien sa ligue.

---

## Phase 7 : conduire les enchères (mi-juillet → mi-août)

**Qui : un admin opérateur, dans Admin → Mercato d'été. C'est l'étape qui
constitue les équipes. Elle s'étale sur plusieurs tours, sur ~1 mois.**

Tout se passe dans **[Admin → Mercato d'été](/admin/encheres)**, une ligue à
la fois (sélecteur de ligue en haut). Les participants, eux, misent depuis
leur page **Enchères** de leur ligue. Rappel du règlement : budget de 130
points, effectif final de 13 joueurs (1 gardien, 3-6 défenseurs, 3-6 milieux,
1-4 attaquants), le gardien se mise **par club** (« Gardiens [Club] »).

Pour **chaque tour** :

1. **Ouvrir un tour** : bouton **« Ouvrir un tour »**. Optionnel mais
   recommandé : renseigner une **heure butoir** (champ date/heure). Si elle
   est renseignée, toute mise reçue après est refusée automatiquement
   (tolérance zéro) ; sinon, c'est votre clôture manuelle qui fait foi.
   Annoncez la date butoir aux participants.
2. **Les participants misent** sur leur page Enchères : ils répartissent leur
   budget sur 13 joueurs (les joueurs déjà acquis aux tours précédents sont
   reportés automatiquement). Le système les avertit en cas de quota dépassé.
3. **Clôturer le tour** : bouton **« Clôturer le tour »** (verrouille les
   soumissions).
4. **Dépouiller** : bouton **« Dépouiller »**. Le système applique le
   règlement tout seul : plus haute mise gagne, **égalité = personne ne
   l'obtient** (joueur remis au tour suivant, points rendus), points non
   dépensés reportés, et pénalités de composition (retraits motivés sur les
   acquisitions les plus chères). Les résultats deviennent visibles côté
   participant (onglet **Résultats** de leur page Enchères).
5. **Notifier les participants** : boutons **« Copier »** (un participant) ou
   **« Tout copier »** : ça met un récap en texte brut dans le presse-papier,
   à **coller dans l'email ou le groupe** des participants. L'envoi est
   **manuel** (les modérateurs), il n'y a pas d'email automatique.
6. **Relancer** : **« Ouvrir le tour suivant »** et reprendre au point 1,
   jusqu'à ce que les effectifs approchent 13 joueurs (4 à 5 tours en général).

**Compléter les effectifs incomplets** : si un participant termine sous
13 joueurs après le dernier tour, l'admin le **complète d'office** à 1 point
par joueur (le système propose des joueurs valides pour respecter les quotas).

**Clore la phase** : quand tous les effectifs sont valides, bouton
**« Clore la phase et constituer les effectifs »**. Action **irréversible** :
elle écrit les équipes définitives (chaque joueur acquis rejoint l'effectif du
participant pour toute la saison). Après ça, « mon équipe » est remplie côté
participants.

---

## Phase 8 : récupérer les photos des joueurs sélectionnés

**Qui : un admin, une fois les équipes constituées (mi-août).**

- Avec le **compte dédié de la Ligue** (jamais des identifiants personnels),
  souscrire l'abonnement TheSportsDB premium (Patreon, palier « Single
  Developer » à ~9 $/mois, sans engagement) et récupérer la clé API.
- Coller la clé dans **Admin → Configuration**, section « Effectifs & photos »,
  champ **« Clé photos »**. Un rappel de résiliation s'affiche tant qu'elle est
  active. La clé change à chaque reprise d'abonnement : la recoller chaque été.
- Cliquer sur **« Récupérer les photos des équipes »** (page Nouvelle
  saison) : le système télécharge sur notre serveur les photos des joueurs
  présents dans les équipes (et seulement eux). Les photos restent ensuite
  affichées toute la saison, abonnement résilié ou pas.
- Le rapport listera les joueurs sans photo trouvée : on peut corriger à la
  main (coller une URL de photo) ou laisser l'avatar à initiales.
- L'opération est rejouable : recliquer complète les manquants.

---

## Phase 9 : réglages avant la première journée

**Qui : n'importe quel admin, tout se fait dans l'admin.**

1. **Synchroniser le calendrier de la Ligue 1** (dates des matchs,
   indispensable pour les deadlines de composition) : bouton
   **« Synchroniser le calendrier »** sur la ligne de la saison, page
   Nouvelle saison. Compter 30 à 60 secondes, rejouable à volonté (à
   re-cliquer en cours de saison si des matchs sont déplacés). Si le message
   dit qu'aucun match n'a été trouvé, le calendrier n'est pas encore publié :
   réessayer quelques jours plus tard, et ne pas oublier de le refaire avant
   la J1.
2. **Re-saisir les dates des jokers** : **Admin → Configuration**. Les quotas
   de jokers sont recopiés de l'an dernier mais les **dates de deadline sont
   volontairement vidées** (les dates de l'an passé seraient fausses).
   Saisir la nouvelle date limite des jokers d'été.
3. **Vérifier le barème** : même page. Confirmer bonus buts par poste, malus
   CSC, heure de deadline. Tout est repris de l'an dernier, il s'agit juste
   de confirmer.
4. **Mercato d'hiver** : rien à faire maintenant, la config se saisit en
   cours de saison dans Admin → Configuration.

---

## Phase 10 : le mois d'août, recrues et résiliation

**Qui : n'importe quel admin (recrues comme résiliation de l'abonnement).**

- **Recrues du mercato** : quand un transfert arrive en Ligue 1 après
  l'import (et jusqu'à fin août, pour que les participants puissent aller
  chercher ces joueurs en joker), un admin clique sur **« Rafraîchir
  l'effectif »** du club concerné (page Nouvelle saison). Le système ajoute
  uniquement les nouveaux joueurs, avec leur photo : rien n'est supprimé ni
  modifié sur les joueurs existants et les équipes constituées. Rejouable à
  volonté.
- **Mi-septembre : RÉSILIER l'abonnement photos** — un admin, depuis le compte
  dédié de la Ligue, un mois pile après la souscription de la phase 8.
  Tout continue de fonctionner à l'identique : les photos sont chez nous,
  les listes de joueurs et le calendrier tournent sur les API gratuites.
  Après la résiliation, une recrue s'ajoute à la main (Admin → Joueurs),
  avec avatar à initiales.
- **Mercato d'hiver (janvier)** : les recrues s'importent gratuitement
  (listes) ; pour leurs photos, les admins décident en décembre : reprendre
  1 mois d'abonnement (recoller la clé) ou laisser les initiales.

---

## Et ensuite

- **Coupe** : le tirage se fait comme d'habitude dans Admin → Coupe, une fois
  la saison lancée.

---

## Récapitulatif en une ligne par phase

| Phase | Quand | Action | Coût / risque |
|---|---|---|---|
| 0 | juin | Clôturer l'ancienne saison ; vérifier la « Clé effectifs » dans Configuration | aucun |
| 1 | début juillet | Créer la saison (libellé `2027`) | aucun |
| 2 | début juillet | Importer clubs + joueurs (sans photos) | aucun |
| 3 | début juillet | Créer les 3 ligues (reprise de 2026) | aucun |
| 4 | début juillet | Inscrire les participants (reprise + ajustements) | aucun |
| 5 | mi-juillet | Ouvrir les enchères (statut) + revue collective | aucun |
| 6 | mi-juillet | **Démarrer la saison** (la rend courante, débloque les enchères) | **bascule le site** |
| 7 | mi-juillet → mi-août | **Conduire les enchères** (tours dans Admin → Mercato d'été) → équipes constituées | aucun |
| 8 | mi-août | Abonnement photos (compte dédié Ligue) + clé dans Config + « Récupérer les photos » | 9 $ |
| 9 | mi-août | Synchroniser le calendrier + dates jokers + vérif barème | à faire vite |
| 10 | fin août | Rafraîchir les effectifs (recrues) puis **RÉSILIER mi-septembre** | oubli = 9 $/mois |

*En cas de doute à n'importe quelle étape : capture d'écran sur le groupe
admins. Tout est prévu pour être rejouable.*
