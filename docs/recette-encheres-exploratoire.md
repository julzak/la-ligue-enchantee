# Recette exploratoire des enchères (étage 4)

Les étages 1-3 (tests unitaires, gardes route, scénario E2E) sont automatisés
et rejouables. Ils ne couvrent PAS : l'ergonomie réelle des écrans, les cas
non anticipés, les régressions visuelles. D'où cette passe **manuelle et
exploratoire**, à faire **avant chaque ouverture réelle** des enchères (été en
juillet, hiver en janvier).

## Principe

Un agent (ou un humain) **à l'aveugle du code** joue une simulation complète
sur l'environnement de recette, calcule les résultats attendus **depuis le
règlement** (`docs/regles-encheres.md`), et logue chaque divergence. C'est ce
qui a permis de valider le module (rapport `audits/2026-06-16-recette-encheres/`)
et de distinguer un vrai bug d'un défaut de banc d'essai.

## Quand

- **Avant l'ouverture des enchères d'été** (début juillet).
- **Avant le mercato d'hiver** (décembre/janvier).
- Après tout changement de fond du moteur ou du dépouillement.

## Procédure

1. Monter l'environnement de recette (cf `audits/recette-encheres-env.md` et
   `tests/e2e/README.md`) : conteneur MySQL, fixture seedée, app en dev.
2. Lancer d'abord les tests automatisés (`npm run test:e2e`) : ils doivent
   être verts. S'ils échouent, corriger AVANT la passe manuelle.
3. Confier la recette exploratoire à un agent frais avec, et seulement avec :
   - le brief `tasks/briefs/BRIEF-07-recette-simulee.md`,
   - le règlement `docs/regles-encheres.md`,
   - le handoff d'environnement `audits/2026-06-16-recette-encheres/HANDOFF.md`.
   **Ne JAMAIS lui donner le code du moteur** : il doit calculer les attendus
   depuis le règlement seul, sinon la recette ne prouve rien.
4. L'agent joue 2 tours + fin de phase via l'UI/HTTP, compare réel vs attendu,
   classe chaque divergence (bug bloquant / mineur / écart d'interprétation),
   et rend un verdict **GO / NO-GO** dans `audits/<date>-recette-encheres/`.
5. **Vérifier le diagnostic contre le code réel avant d'agir** : un agent à
   l'aveugle peut confondre un défaut de fixture avec un bug moteur (déjà
   arrivé : postes seedés en codes courts pris pour un bug de classification).
   Tout NO-GO se vérifie avant d'ouvrir un chantier correctif.

## Modèle de prompt pour l'agent testeur

> Tu es le testeur de recette du module enchères. Tu joues une simulation
> réelle et tu compares le résultat produit à ce que TU calcules depuis le
> règlement. INTERDICTION de lire le code d'implémentation (src/lib/auction*,
> src/app/api/**/auction*) : tu pilotes l'app par ses endpoints HTTP. Lis le
> brief BRIEF-07, le règlement regles-encheres.md et le HANDOFF d'environnement.
> Couvre obligatoirement : une égalité de mise, une mise sans gardien, un excès
> de ligne, un dépassement de budget, une complétion d'office. Pour chaque
> tour, écris l'attendu AVANT de dépouiller. Rends un rapport avec verdict
> GO/NO-GO et le tableau des divergences classées.

## Ce que la recette exploratoire a déjà validé (2026-06-16)

Verdict GO. Confirmés conformes : égalité (personne, points rendus), report
des points, retrait sur la plus chère acquisition/ligne, complétion d'office à
1 pt, gardien par club, écriture TEAM. Aucun bloquant. Findings mineurs traités
en BRIEF-09 (doublon de playerId, robustesse des postes).
