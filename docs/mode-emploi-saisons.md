# Mode d'emploi : clôturer une saison et en démarrer une nouvelle

Tout se passe dans l'admin, page **Nouvelle saison** (menu de gauche).
Aucune saisie technique, tout se fait en quelques clics.

> Important : il **n'y a pas de montées/descentes**. Les ligues sont par
> affinité et restent les mêmes d'une saison à l'autre. La clôture sert
> uniquement à figer le palmarès (podiums + coupe).

---

## A. Clôturer la saison qui vient de finir

> À faire quand la dernière journée est jouée et les notes saisies.

- Aller dans **Admin → Nouvelle saison**.
- En haut, section **Saisons existantes** : chaque saison a un bouton de clôture.
  - Si la saison est en cours (statut `ACTIVE` ou `WINTER`) : le bouton affiche
    **« Clôturer la saison 2026-2027 »** et est actif.
  - Si la saison est déjà clôturée : le bouton affiche **« Saison 2026-2027
    clôturée »** et est **grisé** (rien à faire, c'est déjà fait).
  - Si la saison n'est pas encore démarrée (statut `SETUP` ou `AUCTION`) : le
    bouton est grisé (il faut d'abord démarrer la saison).
- Cliquer sur **Clôturer la saison XXX**, puis confirmer.
- Le système fait tout seul, sans aucune saisie :
  - il fige le **podium** (1er, 2e, 3e) de chaque ligue,
  - il enregistre le **vainqueur et le finaliste de la coupe**.
- Un récapitulatif s'affiche juste après (nombre de podiums, vainqueur de coupe).
- Le **palmarès public** (`/palmares`) est mis à jour immédiatement.
- La clôture est **rejouable sans risque** : recliquer recalcule proprement,
  sans créer de doublon.

---

## B. Démarrer la nouvelle saison

> Se fait dans la même page, partie basse, en 4 étapes guidées (stepper).

### Étape 1 : créer la saison
- Renseigner le **libellé** de la saison : `2026-2027` ou `2027` (l'année de fin).
  Ce format est obligatoire, il sert à retrouver le calendrier et les configs.
- Cliquer sur **Créer la saison**. Elle démarre au statut `SETUP` (préparation).

### Étape 2 : importer les clubs et les joueurs
- Cliquer sur **Récupérer les clubs de Ligue 1** : la liste des clubs s'affiche, tous cochés par défaut.
- Décocher un club si on ne veut pas l'inclure.
- Pour chaque club, cliquer sur **Charger l'effectif** : la liste des joueurs apparaît.
- **Important** : le poste de chaque joueur (Gardien / Défense / Milieu / Attaque) est **modifiable** via le menu déroulant. C'est la classification de la Ligue qui fait foi, pas celle de l'API : corriger ici si besoin avant l'import.
- Cliquer sur **Importer en base** : clubs et joueurs sont enregistrés pour la nouvelle saison.

### Étape 3 : créer les ligues
- Cliquer sur **Pré-remplir 3 ligues (Ligue 1/2/3)** pour partir de la structure habituelle.
  - (ou **Reprendre depuis la saison précédente**, ou **+ Ajouter une ligue** pour faire à la main)
- Pour chaque ligue : un **nom** et un **label de division** (ex : Ligue 1). Le **niveau** sert juste à l'ordre d'affichage (1 = division la plus haute). Les libellés sont libres.
- Cliquer sur **Créer les ligues**, puis passer à l'étape suivante.

### Étape 4 : inscrire les participants
- Cliquer sur **Reprendre les participants de [saison précédente]** : chaque ligue
  est pré-remplie avec ses participants de l'an dernier (les ligues sont par
  affinité, elles ne bougent pas).
- Ajuster si besoin : retirer un participant (croix sur son nom), en ajouter un
  via le menu déroulant. Un participant ne peut être que dans une seule ligue.
- Cliquer sur **Enregistrer les participants**. Rejouable sans risque.

### Faire avancer la saison
Dans **Saisons existantes**, un bouton fait passer la saison à l'étape suivante :
- `SETUP` → **Ouvrir les enchères** (mercato d'été)
- `AUCTION` → **Démarrer la saison** : le système vérifie d'abord une
  **checklist** (ligues créées, clubs et joueurs importés, participants inscrits
  dans chaque ligue). Si quelque chose manque, rien n'est lancé et la liste
  s'affiche avec ✓/✗ pour dire quoi corriger. Si tout est bon :
  - les configs de la saison (barème de scoring, jokers) sont créées
    automatiquement en copiant celles de l'an dernier — **les dates de deadline
    des jokers sont à re-saisir** dans Admin → Configuration ;
  - la saison devient **courante** : tout le site (classements, listes de
    joueurs, mon équipe...) bascule sur ses ligues, clubs et joueurs.
- `ACTIVE` → **Passer en mercato d'hiver** puis **Reprendre la saison**

### Après le lancement
- **Synchroniser le calendrier** Ligue 1 (dates des matchs, indispensable pour
  les deadlines de compo) : demander à l'admin technique de lancer
  `scripts/sync-match-schedule.ts --all` sur le serveur. La checklist du
  lancement rappelle ce point.
- Vérifier dans Admin → Configuration les valeurs reprises de l'an dernier
  (barème, jokers, deadlines).

---

## Points à savoir

- **Une seule saison "courante" à la fois** : démarrer une saison retire automatiquement ce statut à l'ancienne.
- **Pas de montées/descentes** : les ligues sont fixes (par affinité). Le classement final sert au palmarès, pas à changer de division.
- **La saison 2026 est déjà clôturée** : son palmarès est figé et visible sur `/palmares`. Votre première vraie action sera donc de **démarrer la saison suivante** (partie B).
- **Les saisons historiques (palmarès 2017-2026)** sont des archives importées : elles apparaissent dans le palmarès mais n'ont pas de classement détaillé sur la plateforme.
- **Les effectifs de joueurs sont actuellement simulés** (données de démonstration) le temps de brancher la source officielle des effectifs. Les clubs, eux, sont réels. À signaler si vous voulez de vrais joueurs dès maintenant.

---

*En cas de souci à une étape précise, notez le libellé du bouton et le message affiché : ça permet de corriger vite.*
