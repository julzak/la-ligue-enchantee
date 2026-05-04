# La Ligue Enchantée

Fantasy football entre potes (~20 ans d'historique). Chronique IA "Lia" qui rédige la synthèse de chaque journée.

## Déploiement — IMPORTANT

**Production : `https://ligueenchantee.com/` — VPS OVH.** Pas Vercel.

- Migration depuis Vercel effectuée. Le domaine `la-ligue-enchantee.vercel.app` est OBSOLÈTE.
- DB MySQL hébergée séparément sur une instance Scaleway (`51.15.205.26:3306`, db `ligueenc_v3`) — l'IP du VPS OVH est whitelistée côté Scaleway. Si une IP locale dev n'arrive plus à se connecter en TCP/3306, c'est un sujet de whitelist Scaleway, pas un sujet OVH.
- Ne JAMAIS supposer Vercel ; ne pas régénérer de `vercel.json` ; ne pas mentionner les Vercel deploy URLs dans une suggestion d'action.

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
- Cup section : depuis le fix du commit `2f5f9d5`, format `QUALIFIÉS pour le tour suivant: ... ; ÉLIMINÉS de la Coupe: ...` au lieu d'une syntaxe match-par-match avec flèche, pour empêcher Gemini Flash d'inverser qualifié/éliminé.
