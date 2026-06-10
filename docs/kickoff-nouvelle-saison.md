# Kick-off nouvelle saison : mode d'emploi pas à pas

> Pour les admins de la Ligue Enchantée. Suivez les phases DANS L'ORDRE.
> Chaque phase dit : qui la fait, comment la faire, et comment vérifier
> qu'elle est bien faite avant de passer à la suivante.
>
> En cas de pépin à n'importe quelle étape : ne forcez pas, notez le **libellé
> du bouton** cliqué et le **message affiché** (capture d'écran idéale), et
> envoyez ça à Julien. Tout est rejouable, rien n'est cassé définitivement.

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
- Si une saison apparaît encore en ACTIVE ou WINTER : STOP, prévenir Julien
  (il faut d'abord la clôturer, voir le mode d'emploi général).

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
  ⚠️ Ce format est obligatoire : il sert à retrouver le calendrier de la
  Ligue 1 et les réglages de la saison. Pas de « Saison de la gagne » ici,
  le système refusera de lancer plus tard.
- Cliquer sur **Créer la saison**.

**Vérification :** le stepper passe à l'étape 2 et la saison apparaît dans
« Saisons existantes » avec le statut `SETUP`.

---

## Phase 2 : importer les clubs et les joueurs

**Qui : le pilote. Comptez 10-15 minutes.**

- Étape 2 du stepper : cliquer sur **Récupérer les clubs de Ligue 1**.
- La liste des clubs s'affiche, tous cochés. **Décocher** les clubs qu'on ne
  veut pas (et garder la Légion étrangère si elle joue cette saison : elle
  n'apparaîtra pas dans la liste de l'API, voir note ci-dessous).
- Pour chaque club coché : cliquer sur **Charger l'effectif**.
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
- Club hors API (promu, club fantaisie) : prévenir Julien, il l'ajoutera.

---

## Phase 3 : créer les ligues

**Qui : le pilote, 2 minutes.**

- Étape 3 du stepper : cliquer sur **Reprendre depuis 2026** (ça recopie la
  structure de l'an dernier) ou sur **Pré-remplir 3 ligues (Ligue 1/2/3)**.
- Les ligues sont **par affinité** : mêmes ligues, mêmes noms qu'avant. Ne
  changez les noms que si tout le monde est d'accord.
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

**Note :** un nouveau participant doit d'abord avoir un compte sur le site.
S'il n'apparaît pas dans le menu déroulant, prévenir Julien (création de
compte, pas encore self-service).

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
  bloqué à ce stade : demander à Julien de repasser la saison en préparation.

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

**Qui : indiqué pour chaque point.**

1. **Synchroniser le calendrier de la Ligue 1** (dates des matchs,
   indispensable pour les deadlines de composition) : **Julien**, commande
   serveur. La checklist de lancement le rappelle. Sans ça, pas de deadlines
   automatiques.
2. **Re-saisir les dates des jokers** : un admin, dans **Admin →
   Configuration**. Les quotas de jokers sont recopiés de l'an dernier mais
   les **dates de deadline sont volontairement vidées** (les dates de l'an
   passé seraient fausses). Saisir la nouvelle date limite des jokers d'été.
3. **Vérifier le barème** : un admin, même page. Confirmer bonus buts par
   poste, malus CSC, heure de deadline. Tout est repris de l'an dernier,
   il s'agit juste de confirmer.
4. **Mercato d'hiver** : rien à faire maintenant, la config se saisit en
   cours de saison dans Admin → Configuration.
5. **Cotisations** : le module paiements n'est pas encore raccordé à la
   nouvelle saison, gestion à l'ancienne pour l'instant.

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
| 0 | Vérifier que l'ancienne saison est clôturée | aucun |
| 1 | Créer la saison (libellé `2027`) | aucun |
| 2 | Importer clubs + joueurs | aucun |
| 3 | Créer les 3 ligues (reprise de 2026) | aucun |
| 4 | Inscrire les participants (reprise + ajustements) | aucun |
| 5 | Ouvrir les enchères + revue collective | aucun |
| 6 | **Démarrer la saison** | **bascule le site** |
| 7 | Calendrier (Julien) + dates jokers + vérif barème | à faire vite |

*En cas de doute à n'importe quelle étape : capture d'écran + message à
Julien. Tout est prévu pour être rejouable.*
