# Kick-off nouvelle saison : mode d'emploi pas à pas

> Pour les admins de la Ligue Enchantée. Suivez les phases DANS L'ORDRE.
> Chaque phase dit : qui la fait, comment la faire, et comment vérifier
> qu'elle est bien faite avant de passer à la suivante.
>
> **Tout le kick-off se fait en autonomie, depuis l'admin du site.**
>
> **Voie d'exception** (la seule raison de solliciter Julien) : un message
> d'erreur inattendu, ou le cas signalé « voie d'exception » plus bas.
> Dans ce cas : ne forcez pas, notez le **libellé du bouton** cliqué et
> le **message affiché** (capture d'écran idéale), et postez ça sur le groupe
> admins. Tout est rejouable, rien n'est cassé définitivement.

**Les deux règles d'or :**

1. Les phases 1 à 5 sont **sans danger** : elles préparent la saison en
   coulisses, le site public ne change pas. Vous pouvez vous y reprendre à
   plusieurs fois.
2. La phase 6 (bouton « Démarrer la saison ») **bascule tout le site
   immédiatement** sur la nouvelle saison. On ne la fait qu'une fois, quand
   tout le monde est d'accord que c'est prêt.

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

- **Les clubs importés sont réels, mais les joueurs sont pour l'instant
  SIMULÉS** (données de démonstration, en attendant le branchement de la
  source officielle des effectifs). C'est normal de voir des noms fantaisistes
  pendant les essais. Ne pas corriger les joueurs à la main un par un, ça sera
  écrasé au branchement de la vraie source.
- **Le module enchères n'existe pas encore** sur la plateforme : après le
  lancement, les participants n'auront pas d'équipe tant que les enchères
  n'auront pas eu lieu (module prévu avant le mercato d'août).

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

## Phase 2 : importer les clubs et les joueurs

**Qui : le pilote. Comptez 10-15 minutes.**

- Étape 2 du stepper : cliquer sur **Récupérer les clubs de Ligue 1**.
- La liste des 18 clubs de Ligue 1 s'affiche, tous cochés : c'est ce qu'on
  veut, ne décochez rien.
- Pour chaque club : cliquer sur **Charger l'effectif**.
- Contrôler le **poste** de chaque joueur (Gardien / Défense / Milieu /
  Attaque) : le menu déroulant est modifiable et c'est la classification de
  la Ligue qui fait foi, pas celle de l'API. (Avec les joueurs simulés
  actuels, ne perdez pas de temps là-dessus, ce sera à refaire avec les vrais
  effectifs.)
- Cliquer sur **Importer en base**.

**Vérification :** le message « X clubs et Y joueurs importés » s'affiche.
Dans « Saisons existantes », la ligne de la saison affiche les compteurs de
clubs et joueurs.

**Notes :**
- L'import est rejouable sans danger : re-cliquer **remplace** l'import
  précédent (pas de doublons). Si vous avez oublié un club, recommencez
  l'étape en entier (re-cocher les clubs, recharger les effectifs, ré-importer).
- Club absent de la liste (promu manquant, club fantaisie type Légion
  étrangère) : **voie d'exception**, l'ajout manuel n'est pas encore dans
  l'admin.

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

## Et ensuite

- **Enchères** : module en cours de développement, livré avant le mercato
  d'août. C'est lui qui donnera leurs équipes aux participants. D'ici là,
  les pages « Mon équipe » resteront vides : normal.
- **Vrais effectifs de joueurs** : branchement d'une source officielle prévu
  avant les enchères. Les joueurs simulés seront remplacés à ce moment-là.
- **Coupe** : le tirage se fait comme d'habitude dans Admin → Coupe, une fois
  la saison lancée.

---

## Récapitulatif en une ligne par phase

| Phase | Action | Risque |
|---|---|---|
| 0 | Clôturer l'ancienne saison si ce n'est pas déjà fait | aucun |
| 1 | Créer la saison (libellé `2027`) | aucun |
| 2 | Importer clubs + joueurs | aucun |
| 3 | Créer les 3 ligues (reprise de 2026) | aucun |
| 4 | Inscrire les participants (reprise + ajustements) | aucun |
| 5 | Ouvrir les enchères + revue collective | aucun |
| 6 | **Démarrer la saison** | **bascule le site** |
| 7 | Synchroniser le calendrier + dates jokers + vérif barème | à faire vite |

*En cas de doute à n'importe quelle étape : capture d'écran sur le groupe
admins (voir « voie d'exception » en tête de doc). Tout est prévu pour être
rejouable.*
