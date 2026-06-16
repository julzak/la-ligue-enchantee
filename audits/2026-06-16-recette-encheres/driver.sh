#!/usr/bin/env bash
# Driver jetable recette E2E enchères. Tout en HTTP, jamais de SQL pour jouer.
set -u
cd /Users/julienzakoian/Projects/la-ligue-enchantee
source audits/2026-06-16-recette-encheres/lib-auth.sh

J1=/tmp/jar-j1.txt; J2=/tmp/jar-j2.txt; J3=/tmp/jar-j3.txt; J4=/tmp/jar-j4.txt; AD=/tmp/jar-admin.txt
LOG=audits/2026-06-16-recette-encheres/raw-responses.log

log(){ echo "=== $* ===" | tee -a "$LOG"; }
cap(){ tee -a "$LOG"; echo | tee -a "$LOG"; }

case "${1:-}" in
  login)
    login_user "Joueur1" $J1; login_user "Joueur2" $J2
    login_user "Joueur3" $J3; login_user "Joueur4" $J4
    login_user "RecetteAdmin" $AD
    ;;
  bid)
    jar="$2"; body="$3"
    api_post "$jar" "/api/auction" "$body" | jq -c . | cap
    ;;
  get)
    jar="$2"
    api_get "$jar" "/api/auction?leagueId=24" | jq . | cap
    ;;
  admin-get)
    api_get $AD "/api/admin/auction?leagueId=24" | jq . | cap
    ;;
  admin)
    body="$2"
    api_post $AD "/api/admin/auction" "$body" | jq -c . | cap
    ;;
  results)
    r="$2"
    api_get $J1 "/api/auction/results?leagueId=24&round=$r" | jq . | cap
    ;;
esac
