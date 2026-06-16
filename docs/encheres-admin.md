# Comment fonctionnent les enchères

Cette page explique le mécanisme des enchères d'été pour que vous puissiez les
piloter et répondre aux participants. Le règlement complet et formel reste
`docs/regles-encheres.md` (source de vérité). Pour la procédure pas à pas dans
le kick-off de saison, voir **[Kick-off saison](/admin/kickoff)**, phase 7.

## Le principe

Avant le championnat, chaque participant se constitue une équipe par des
**enchères fermées sur plusieurs tours** (4 à 5 en général). Chacun dispose
d'un **budget de 130 points** à répartir comme il veut sur les joueurs qu'il
convoite. Personne ne voit les mises des autres avant le dépouillement.

À la fin, chaque équipe compte **13 joueurs** : 1 gardien, 3 à 6 défenseurs,
3 à 6 milieux, 1 à 4 attaquants.

> Le gardien se mise **par club** (« Gardiens [Club] »), jamais un gardien
> nommé : c'est le gardien aligné par le club à chaque journée qui rapporte
> les points.

## Le déroulé d'un tour (côté admin)

Tout se passe dans **[Admin → Mercato d'été](/admin/encheres)**, une ligue à la
fois.

1. **Ouvrir un tour.** Vous pouvez fixer une **heure butoir** (facultatif). Si
   elle est renseignée, toute mise reçue après est refusée automatiquement
   (tolérance zéro) ; sinon, c'est votre clôture manuelle qui fait foi.
   Annoncez la date butoir aux participants.
2. **Les participants misent** depuis leur page Enchères (ils répartissent leur
   budget sur 13 joueurs ; les joueurs déjà acquis aux tours précédents sont
   reportés automatiquement).
3. **Clôturer le tour** (verrouille les soumissions).
4. **Dépouiller.** Le système applique le règlement tout seul (voir les règles
   ci-dessous) et les résultats deviennent visibles côté participant.
5. **Notifier** : « Copier » / « Tout copier » met un récap en texte brut dans
   le presse-papier, à **coller dans l'email ou le groupe** des participants.
   L'envoi est **manuel** (pas d'email automatique).
6. **Ouvrir le tour suivant** et recommencer, jusqu'à ce que les effectifs
   approchent 13 joueurs.

## Les règles que le dépouillement applique

- **Attribution.** Pour chaque joueur, la **mise la plus élevée l'emporte**, au
  prix misé.
- **Égalité.** Si deux participants misent le même montant maximum sur un
  joueur, **personne ne l'obtient** : il est remis en jeu au tour suivant et
  les points sont rendus aux deux. (Pas de premier arrivé, pas d'alphabétique.)
- **Report des points.** Les points misés sur des joueurs non obtenus sont
  **récupérés** pour le tour suivant. Le budget est donc dynamique : on ne perd
  que ce qu'on dépense réellement.
- **Pénalités de composition.** Si une mise est invalide (pas de gardien,
  dépassement de quota par ligne, mauvais total de joueurs, total > budget),
  des **retraits** sont appliqués sur les acquisitions du tour, en commençant
  par la **plus chère** (ordre alphabétique en cas d'égalité de prix ; dans la
  ligne concernée pour un excès de ligne). On ne retire jamais plus de joueurs
  que le participant n'en a obtenu : aucune dette n'est reportée.

## La fin des enchères

- **Complétion d'office.** Si un participant termine sous 13 joueurs, l'admin
  complète son effectif avec des joueurs disponibles à **1 point** chacun.
- **Clore la phase.** Quand tous les effectifs sont valides, le bouton
  **« Clore la phase et constituer les effectifs »** écrit les équipes
  définitives (action **irréversible**). Les participants voient alors leur
  équipe dans « Mon équipe ».

## Le mercato d'hiver

Mécanisme différent (budget inversement proportionnel au classement de la J19,
un seul tour). Il se pilote dans **Admin → Mercato d'hiver**, pas ici.
