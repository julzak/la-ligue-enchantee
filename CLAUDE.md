# La Ligue Enchantée

Fantasy football entre potes (~20 ans d'historique). Chronique IA "Lia" qui rédige la synthèse de chaque journée.

## Déploiement — IMPORTANT

**Production : `https://ligueenchantee.com/` — VPS OVH.** Pas Vercel.

- Migration depuis Vercel effectuée. Le domaine `la-ligue-enchantee.vercel.app` est OBSOLÈTE.
- DB MySQL hébergée séparément sur une instance Scaleway (`51.15.205.26:3306`, db `ligueenc_v3`) — l'IP du VPS OVH est whitelistée côté Scaleway. Si une IP locale dev n'arrive plus à se connecter en TCP/3306, c'est un sujet de whitelist Scaleway, pas un sujet OVH.
- Ne JAMAIS supposer Vercel ; ne pas régénérer de `vercel.json` ; ne pas mentionner les Vercel deploy URLs dans une suggestion d'action.

### Accès et deploy

- SSH alias : `ligue-ovh` (config dans `~/.ssh/config`, host `vps-8428e40e.vps.ovh.net`, user `ubuntu`)
- Chemin projet sur le serveur : `/opt/la-ligue-enchantee/`
- Process manager : pm2, app nommée `ligue` (`pm2 ls`, `pm2 logs ligue`, `pm2 restart ligue`)
- **Auto-deploy actif depuis le 2026-05-30** : tout push sur `main` déclenche
  `.github/workflows/deploy.yml` (SSH vers OVH : `git reset --hard origin/main`
  + `npm install` + `npm run build` + `pm2 restart ligue`). Run ~45s. Déclenchable
  à la main via `gh workflow run deploy.yml`.
- **L'auto-deploy ne touche JAMAIS la base.** Le projet n'utilise pas Prisma
  Migrate (`build` = `prisma generate && next build`, ne modifie pas le schéma).
  Toute migration SQL (`sql/*.sql`) reste un acte manuel à appliquer AVANT le
  push du code qui en dépend, sinon la prod casse au déploiement auto.
- Deploy manuel encore possible au besoin :
  ```bash
  ssh ligue-ovh 'cd /opt/la-ligue-enchantee && git pull && npm install && npm run build && pm2 restart ligue'
  ```

## Stack
- Next.js 14 (App Router), TypeScript, Tailwind, shadcn (v4 + Base UI)
- Prisma + MySQL (driver `mysql2`)
- NextAuth pour l'auth
- Anthropic SDK + Google Gemini (`gemini-2.5-flash` primaire, fallback Gemini 2.0/1.5 puis Claude Sonnet 4.6) pour la synthèse Lia (`src/app/api/topo/route.ts`)

## Conventions
- Scripts diagnostics ad-hoc : `scripts/diag-*.ts`, exécutés via `./node_modules/.bin/tsx scripts/diag-foo.ts` (pas `npx tsx` — npm 11 fait tomber `npx`). Ces scripts importent uniquement `prisma` (pas `db.ts` qui dépend de `react.cache` et plante hors RSC).
- Tests de non-régression LLM : `scripts/test-*.ts` avec sanity-check du détecteur sur le texte buggué d'origine pour prouver que le test peut détecter la régression.
- `.gitignore` ignore `ligueenc_*.sql` (dumps légers gardés à la racine pour reconstruction historique). Vieux dumps massifs en `sql/legacy/` (gitignorés via le même pattern).

## Mécaniques notables
- TOPO (synthèse Lia) : route `POST /api/topo` avec `{slug, force?}`. `force: true` bypass le cache pour forcer la régénération (utile après un fix de prompt). Pas d'auth sur cette route — à durcir un jour.
- Quota jokers : calcul unique dans `src/lib/joker-quota-core.ts` (pur, testé dans `joker-quota.test.ts`) + wrapper DB `joker-quota.ts`, partagé par `/api/jokers`, `/api/admin/jokers` et `getLeagueJokersRemaining` (classement). Chaque joker est attribué au pot ouvert au moment de sa pose (`JOKER_LOG.created_at`) qui expire le plus tôt : un joker posé avant la deadline des jokers d'août consomme le pot d'août, jamais le pot saison. Passé la deadline, seuls les jokers d'août NON utilisés sont perdus. Ne JAMAIS revenir à `Σ max_count des pots ouverts − COUNT(JOKER_LOG)` (bug du 2026-09-02 : tout le monde perdait 3 jokers à la deadline, utilisés ou non).
- Cup section : depuis le fix du commit `2f5f9d5`, format `QUALIFIÉS pour le tour suivant: ... ; ÉLIMINÉS de la Coupe: ...` au lieu d'une syntaxe match-par-match avec flèche, pour empêcher Gemini Flash d'inverser qualifié/éliminé.

# Snippet to append to ~/Projects/la-ligue-enchantee/CLAUDE.md

Add this section after "Mécaniques notables" (or wherever fits in your current structure).

---

## Règles métier critiques

### Barème de scoring (source de bugs historique)

Le mot "forfaitaire" dans `regles-scoring.md` veut dire "valeur fixe", pas "forfait au sens sportif". Source d'ambiguïté connue. Référence stricte :

| Cas | Points | Notes |
|---|---|---|
| Forfait (joueur pas dans la feuille de match, n'a pas joué) | **0** | jamais 2 |
| Carton rouge | **0** | peu importe le temps de jeu (bonus buts/passes conservés) |
| Joueur sans ligne SCORE saisie en DB | **0** | équivalent forfait, pas 2 |
| Joueur entré ET ayant joué mais pas noté par L'Équipe | **2** | temps de jeu insuffisant pour notation |

Toute régression sur ces 4 cas doit être détectée par un script `scripts/test-bareme-*.ts` avant deploy. Le test doit inclure un sanity-check sur la donnée buggée d'origine pour prouver qu'il peut détecter la régression qu'il garde.

**Socle unique depuis 2026-08 (`src/lib/scoring-core.ts`).** Le calcul du barème est une fonction PURE (`computePlayerTotal`, `baseNoteAfterRedCard`, `goalBonusForPosition`) partagée par le moteur autoritaire (`api/admin/publish` qui écrit `STATS_USER` = le classement) ET l'affichage (`db.ts` `calcPlayerTotal`). Avant l'unification, `publish` codait le barème en dur et ignorait `SCORING_CONFIG` : éditer le barème faisait diverger classement et fiches joueurs. Ne JAMAIS re-coder un barème en dur dans `publish` ou `db.ts` : tout passe par `scoring-core` + `getScoringConfig`. Tests : `src/lib/scoring-core.test.ts` (dont un test d'épinglage prouvant que la config par défaut reproduit l'ancien calcul à l'identique), wrapper CLI `scripts/test-bareme-core.ts`.

**Barème éditable uniquement en avant-saison.** L'UI admin (`/admin/config`, section Scoring) et la route `POST /api/admin/config` (section `scoring`) refusent toute modification du barème dès qu'une journée est publiée (`getCurrentMatchday() > 0`), pour ne pas fausser un classement déjà calculé. En avant-saison, la modification exige une confirmation lourde (retaper "Configuration" dans une modale). Les réglages deadline (`deadline_hour`, etc.) restent éditables toute la saison.

### Format Cup section (anti-inversion Gemini Flash)

Depuis le commit `2f5f9d5`, le format pour la section Coupe est :

```
QUALIFIÉS pour le tour suivant: ...
ÉLIMINÉS de la Coupe: ...
```

Ne JAMAIS revenir à un format match-par-match avec flèche (`Équipe A → Équipe B`) : Gemini Flash inversait régulièrement qualifié/éliminé.

## Module Enchères (à implémenter pour démarrage août 2026)

**Premier démarrage des enchères sur la nouvelle plateforme. Aucun historique de bugs runtime. À traiter en zone à haut risque.**

Règlement source de vérité : `docs/regles-encheres.md`. Toujours lire ce fichier avant de toucher au module enchères. Ne jamais re-déduire les règles depuis le code ou la mémoire.

### Pièges connus du règlement (anti-bugs)

Ces points sont les plus piégeux dans le règlement officiel. Tout fix ou ajout dans le module enchères doit avoir un test de non-régression sur chacun.

**1. Le gardien est lié à un CLUB, pas à un joueur.**
La donnée stockée doit être `gardiens_marseille` ou équivalent, pas `Mandanda`. Si un participant mise `Mandanda`, la mise doit être convertie ou rejetée explicitement. Le scoring du gardien doit toujours prendre le gardien aligné par le club à la journée concernée, pas un joueur figé.

**2. Égalité de mise sur un joueur = personne ne l'obtient.**
Pas "attribué au premier arrivé", pas "attribué alphabétiquement". Le joueur est remis en jeu au tour suivant. Les points misés sont récupérés pour les deux participants.

**3. Points non utilisés au tour N = reportés au tour N+1.**
Le budget restant est dynamique. Un participant qui a misé 130 points au tour 1 et obtenu pour 80 points de joueurs commence le tour 2 avec 50 points de plus que ce qu'il avait misé au tour 1 sur des joueurs perdus. Source de bugs : un calcul de budget qui ne tracerait que les acquisitions sans tracer les mises perdues.

**4. Pénalités de composition appliquées AVANT calcul du round.**
Si la mise est invalide (pas de gardien, dépassement de quota par ligne, mauvais total de joueurs, dépassement budget), des retraits doivent être appliqués sur les acquisitions du tour. Ces retraits se font sur les acquisitions LES PLUS ÉLEVÉES en priorité. En cas d'égalité sur le montant : ordre alphabétique.

**5. Le retrait ne peut pas créer d'acquisition négative.**
Si la pénalité dit "retire 2 joueurs" mais que le participant n'a obtenu qu'1 joueur au tour, on ne retire qu'1 joueur. Pas de dette portée au tour suivant.

**6. Quotas effectif (13 joueurs) vs quotas titulaires (11 joueurs) sont différents.**
Effectif total : 1 GK, 3-6 DEF, 3-6 MIL, 1-4 ATT (somme = 13). Composition titulaires journée : 1 GK, ≥3 DEF, ≥3 MIL, 1-3 ATT (somme = 11). Le module enchères valide l'effectif, le module titulaires valide les compositions. Ne pas mélanger.

**7. Heure butoir = email faisant foi dans le règlement papier.**
Sur la nouvelle plateforme, c'est le timestamp serveur de soumission qui fait foi. Préciser ça aux participants au démarrage. Tolérance = 0 : une mise reçue à T+1 seconde après la deadline est rejetée, pas placée au tour suivant.

**8. Mercato d'hiver : budget inversement proportionnel au classement J19.**
Pas le même mécanisme que le mercato d'été. À traiter dans un module séparé pour éviter de casser le mercato d'été en touchant à l'autre.

### Contrat de test pour le module enchères

**Source de vérité : `src/lib/auction-engine.test.ts`** (vitest, tourne dans `npm test` et la gate CI).

Les 7 cas du contrat sont portés sous vitest depuis le chantier BRIEF-01 (2026-06-11) :

| Cas | Describe vitest | Règle |
|---|---|---|
| Égalité de mise | `égalité de mise : personne n'obtient le joueur` | 3.2.a |
| Mise sans gardien | `mise sans gardien : retrait d'1 joueur sur la plus chère (alphabétique)` | 3.2.c |
| Dépassement de budget | `dépassement de budget : retrait d'1 joueur (la plus grosse acquisition)` | 3.2.c |
| Excès d'attaquants | `excès d'attaquants : retrait dans la ligne ATT uniquement` | 3.2.c |
| Report des points | `report des points : mises perdues récupérées au tour suivant` | 3.2.b |
| Retrait insuffisant | `retrait insuffisant : pénalité bornée aux acquisitions réelles, pas de dette` | 3.2.c.4 |
| Deadline tolérance zéro | `deadline : tolérance zéro, tour fermé = rejet` | 3.1 |

Chaque describe inclut un sanity-check qui prouve que le test détecterait la régression qu'il garde.

**Wrappers CLI** : les scripts `scripts/test-encheres-*.ts` sont des wrappers qui délèguent à vitest avec un filtre de nom. Ils permettent l'exécution ad-hoc ciblée (`./node_modules/.bin/tsx scripts/test-encheres-egalite.ts`). Ne pas y remettre de logique : toute modification doit se faire dans `src/lib/auction-engine.test.ts`.

### Tests à effectuer en recette fonctionnelle

Avant l'ouverture des enchères réelles en août, organiser une simulation interne (3-5 participants, joueurs fictifs) sur 2 tours complets pour exercer les cas limites en conditions réelles. Loguer chaque divergence entre le résultat attendu (calculé à la main) et le résultat produit par le système.