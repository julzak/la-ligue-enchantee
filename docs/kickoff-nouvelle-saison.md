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

- **Désigner un admin « pilote effectifs »** : c'est lui qui prendra
  l'abonnement photos (TheSportsDB, 9 $ pour UN mois au moment du lancement)
  et qui le résiliera début septembre. Voir phase 6bis et phase 8.
- **Calendrier d'été** : les phases 1 à 5 se font début juillet (les listes
  de joueurs sont gratuites, pas besoin d'attendre). Les **enchères occupent
  juillet**, les équipes sont complètes début août, et le lancement
  (phase 6) suit. Pendant les enchères, les joueurs n'ont pas de photo
  (avatar à initiales) : c'est voulu, les photos ne sont récupérées que
  pour les joueurs réellement sélectionnés, au lancement.
- **Le module enchères est en cours de développement** (livraison prévue
  avant juillet) : après le lancement, les participants n'auront pas
  d'équipe tant que les enchères n'auront pas eu lieu.
- Les écrans « clé effectifs », « clé photos », « récupérer les photos des
  équipes » et « rafraîchir l'effectif d'un club » décrits plus bas arrivent
  avec la mise à jour de fin juin. Si vous lisez ce guide avant et que vous
  ne les voyez pas, c'est normal.

---

## Phase 1 : créer la saison

**Qui : un seul admin (désignez-vous un pilote pour tout le kick-off).**

- Page **Admin → Nouvelle saison**, partie basse, étape 1 du stepper.
- Saisir le libellé : **`2027`** (ou `2026-2027`, les deux marchent).
  Ce format est obligatoire : il sert à retrouver le calendrier de la
  Ligue 1 et les réglages de la saison.
- Cliquer sur **Créer la saison**.

**Vérification :** le stepper passe à l'étape 2 et la saison apparaît dans
« Saisons existantes » avec le statut `SETUP`.

---

## Phase 1bis : activer la source des effectifs (gratuite)

**Qui : l'admin pilote effectifs, 10 minutes, une seule fois.**

- Créer un compte gratuit sur football-data.org et récupérer le token API
  (c'est la source des listes de joueurs : effectifs complets de Ligue 1,
  gratuits, sans photos).
- Coller le token dans **Admin → Configuration**, champ **« Clé effectifs »**.
- Rien à payer à cette étape. L'abonnement photos (9 $) n'arrive qu'au
  lancement, phase 6bis.

**Vérification :** l'étape 2 du stepper affiche « API live » comme source
(et non plus « données simulées »).

---

## Phase 2 : importer les clubs et les joueurs

**Qui : le pilote. Comptez 10-15 minutes.**

- Étape 2 du stepper : cliquer sur **Récupérer les clubs de Ligue 1**.
- La liste des 18 clubs de Ligue 1 s'affiche, tous cochés : c'est ce qu'on
  veut, ne décochez rien.
- Pour chaque club : cliquer sur **Charger l'effectif**.
- Contrôler le **poste** de chaque joueur (Gardien / Défense / Milieu /
  Attaque) : le menu déroulant est modifiable et c'est la classification de
  la Ligue qui fait foi, pas celle de l'API (qui est parfois approximative,
  surtout sur les milieux offensifs et les pistons).
- Cliquer sur **Importer en base**. À ce stade les joueurs n'ont **pas de
  photo** (avatar à initiales) : c'est normal, les photos arrivent au
  lancement (phase 6bis), uniquement pour les joueurs sélectionnés dans les
  équipes.

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

**Qui : le pilote, 2 minutes.**

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

**Qui : le pilote, avec la liste des inscrits de la saison validée entre vous.**

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
  passe en `AUCTION`). C'est encore sans effet sur le site public.
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
  publié, autant l'avoir avant le lancement ; sinon le message vous dira de
  réessayer plus tard, sans conséquence.

**STOP ici tant que tout le monde n'a pas validé.** La phase 6 bascule le site.

---

## Phase 6 : LANCEMENT (bascule du site)

**Qui : le pilote, prévenir les autres admins juste avant.**

- Dans « Saisons existantes », cliquer sur **Démarrer la saison**.
- Le système vérifie d'abord une **checklist** : ligues créées, clubs et
  joueurs importés, participants dans chaque ligue, libellé exploitable.
  - Si quelque chose manque : **rien n'est lancé**, la liste s'affiche avec
    ✓ et ✗. Corrigez le point en ✗ (la checklist indique l'étape du stepper
    concernée) puis re-cliquez.
  - Si tout est bon : la saison passe en `ACTIVE`, devient la saison
    **courante**, et les réglages (barème de scoring, jokers) sont créés
    automatiquement en copiant ceux de l'an dernier.
- À partir de cet instant, tout le site (classements, listes de joueurs,
  mon équipe, explorateur) montre la nouvelle saison.

**Vérification immédiate (5 minutes, à plusieurs) :**
- La page d'accueil et les 3 pages de ligues s'affichent sans erreur.
- Les classements sont vides ou à zéro : **c'est normal**, la saison n'a pas
  commencé.
- Chaque admin se connecte et vérifie qu'il voit bien sa ligue.

---

## Phase 6bis : récupérer les photos des joueurs sélectionnés

**Qui : l'admin pilote effectifs, juste après le lancement (début août).**

- Souscrire l'abonnement TheSportsDB premium (Patreon, palier « Single
  Developer » à 9 $/mois, sans engagement) et récupérer la clé API sur son
  compte TheSportsDB.
- Coller la clé dans **Admin → Configuration**, champ **« Clé photos »**.
  Un rappel de résiliation s'affichera dans l'admin tant qu'elle est active.
- Cliquer sur **« Récupérer les photos des équipes »** (page Nouvelle
  saison) : le système télécharge sur notre serveur les photos des joueurs
  présents dans les équipes (et seulement eux). Les photos restent ensuite
  affichées toute la saison, abonnement résilié ou pas.
- Le rapport listera les joueurs sans photo trouvée : on peut corriger à la
  main (coller une URL de photo) ou laisser l'avatar à initiales.
- L'opération est rejouable : recliquer complète les manquants.

---

## Phase 7 : juste après le lancement

**Qui : le pilote (ou n'importe quel admin), tout se fait dans l'admin.**

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

## Phase 8 : le mois d'août, recrues et résiliation

**Qui : n'importe quel admin pour les recrues, le pilote effectifs pour la
résiliation.**

- **Recrues du mercato** : quand un transfert arrive en Ligue 1 après
  l'import (et jusqu'à fin août, pour que les participants puissent aller
  chercher ces joueurs en joker), un admin clique sur **« Rafraîchir
  l'effectif »** du club concerné (page Nouvelle saison). Le système ajoute
  uniquement les nouveaux joueurs, avec leur photo : rien n'est supprimé ni
  modifié sur les joueurs existants et les équipes constituées. Rejouable à
  volonté.
- **Début septembre : RÉSILIER l'abonnement photos** (le pilote, depuis son
  compte Patreon, un mois pile après la souscription de la phase 6bis).
  Tout continue de fonctionner à l'identique : les photos sont chez nous,
  les listes de joueurs et le calendrier tournent sur les API gratuites.
  Après la résiliation, une recrue s'ajoute à la main (Admin → Joueurs),
  avec avatar à initiales.
- **Mercato d'hiver (janvier)** : les recrues s'importent gratuitement
  (listes) ; pour leurs photos, le pilote décidera en décembre : reprendre
  1 mois d'abonnement ou laisser les initiales.

---

## Et ensuite

- **Enchères** : module en cours de développement, livré avant la mi-août.
  C'est lui qui donnera leurs équipes aux participants. D'ici là, les pages
  « Mon équipe » resteront vides : normal.
- **Coupe** : le tirage se fait comme d'habitude dans Admin → Coupe, une fois
  la saison lancée.

---

## Récapitulatif en une ligne par phase

| Phase | Quand | Action | Coût / risque |
|---|---|---|---|
| 0 | juin | Clôturer l'ancienne saison + désigner le pilote effectifs | aucun |
| 1 | début juillet | Créer la saison (libellé `2027`) | aucun |
| 1bis | début juillet | Token gratuit football-data.org dans l'admin | 0 $ |
| 2 | début juillet | Importer clubs + joueurs (sans photos, c'est normal) | aucun |
| 3 | début juillet | Créer les 3 ligues (reprise de 2026) | aucun |
| 4 | début juillet | Inscrire les participants (reprise + ajustements) | aucun |
| 5 | début juillet | Ouvrir les enchères + revue collective | aucun |
| — | juillet | Les enchères se jouent (équipes complètes début août) | aucun |
| 6 | début août | **Démarrer la saison** | **bascule le site** |
| 6bis | début août | Abonnement photos 9 $ + « Récupérer les photos des équipes » | 9 $ |
| 7 | début août | Synchroniser le calendrier + dates jokers + vérif barème | à faire vite |
| 8 | août | Rafraîchir les effectifs (recrues) puis **RÉSILIER début septembre** | oubli = 9 $/mois |

*En cas de doute à n'importe quelle étape : capture d'écran sur le groupe
admins. Tout est prévu pour être rejouable.*
