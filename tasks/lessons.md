# Lessons - La Ligue Enchantée

## 2026-07-30 : reset --hard a effacé du travail non commité (incident évité de peu)

Pendant le fix de l'import effectifs, un `git reset --hard origin/main` a été lancé alors que l'arbre de travail contenait des modifications forum non commitées (et un commit que le hook de protection main avait en réalité bloqué, chaîné en `git commit && git push`). Les modifications ont été récupérées uniquement grâce à un vieux stash dangling identique.

Règles à appliquer désormais :
1. Jamais de `git reset --hard` sans un `git status --porcelain` juste avant prouvant que l'arbre est propre (ou après un `git stash push` de sécurité).
2. Jamais chaîner `git commit && git push` : si un hook bloque la commande entière, on croit le commit créé alors qu'il n'existe pas. Committer, vérifier `git log -1`, puis pousser.
3. Le hook global bloque le push direct sur main : passer par branche + PR + merge après CI verte.

## 2026-07-30 : erreur MySQL 3988 = table legacy en latin1

Toute erreur `Conversion from collation ... into latin1_swedish_ci impossible` vient d'une table héritée de l'ancien site PHP restée en `latin1_swedish_ci` (liste dans la mémoire projet). Fix : `ALTER TABLE x CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci` après backup et vérification que les données sont en latin1 propre (pas de mojibake : `HEX()` sur un échantillon accentué, é = E9).

Symptôme côté UI : `JSON.parse: unexpected end of data` quand la route API n'a pas de try/catch (500 à corps vide). Toute nouvelle route admin doit renvoyer un JSON d'erreur explicite.
