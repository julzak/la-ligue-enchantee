#!/usr/bin/env bash
# Helper d'authentification pour la recette E2E du module enchères.
# Flux next-auth credentials : CSRF -> callback -> cookie de session.
# Le cookie de session est stocké dans un "jar" par utilisateur, à réutiliser
# ensuite avec `curl -b "$jar"` sur les endpoints de l'app (comme le ferait
# le navigateur). On ne touche JAMAIS la base en SQL pour jouer l'enchère :
# tout passe par les routes HTTP que l'UI appelle.
#
# Usage :
#   source lib-auth.sh
#   login_user "Joueur1" /tmp/jar-j1.txt     # se connecte, vérifie la session
#   api_get  /tmp/jar-j1.txt "/api/auction?leagueId=24"
#   api_post /tmp/jar-j1.txt "/api/auction" '{"leagueId":24,"bids":[...]}'

BASE="${RECETTE_BASE:-http://localhost:3100}"
PASSWORD="${RECETTE_PASSWORD:-recette2026}"

login_user() {
  local login="$1" jar="$2"
  : > "$jar"
  local csrf
  csrf=$(curl -s -c "$jar" "$BASE/api/auth/csrf" | jq -r .csrfToken)
  if [ -z "$csrf" ] || [ "$csrf" = "null" ]; then
    echo "ECHEC: pas de csrfToken (app démarrée sur $BASE ?)" >&2
    return 1
  fi
  curl -s -b "$jar" -c "$jar" \
    --data-urlencode "csrfToken=$csrf" \
    --data-urlencode "login=$login" \
    --data-urlencode "password=$PASSWORD" \
    --data-urlencode "redirect=false" \
    --data-urlencode "json=true" \
    "$BASE/api/auth/callback/credentials" > /dev/null
  # Vérifie la session
  local uid
  uid=$(curl -s -b "$jar" "$BASE/api/auth/session" | jq -r '.user.userId // empty')
  if [ -z "$uid" ]; then
    echo "ECHEC login $login : session vide" >&2
    return 1
  fi
  echo "$login -> userId=$uid"
}

api_get()  { curl -s -b "$1" "$BASE$2"; }
api_post() { curl -s -b "$1" -H "Content-Type: application/json" -X POST -d "$3" "$BASE$2"; }
