#!/usr/bin/env bash
# Rejeu post-fix BLOQUANT-1/2 (recette enchères). Positions fixture en CODES
# COURTS (G/DEF/MIL/ATT) pour exercer la racine du bug. Scénario = run1.
set -u
cd /Users/julienzakoian/Projects/la-ligue-enchantee
source /Users/julienzakoian/Projects/la-ligue-enchantee/audits/2026-06-16-recette-encheres/lib-auth.sh

J1=/tmp/jar-j1.txt; J2=/tmp/jar-j2.txt; J3=/tmp/jar-j3.txt; J4=/tmp/jar-j4.txt; AD=/tmp/jar-admin.txt

echo "== LOGIN =="
login_user "Joueur1" $J1; login_user "Joueur2" $J2
login_user "Joueur3" $J3; login_user "Joueur4" $J4
login_user "RecetteAdmin" $AD

bid(){ api_post "$1" "/api/auction" "$2" | jq -c .; }
adm(){ api_post $AD "/api/admin/auction" "$1" | jq -c .; }

echo "== TOUR 1 : soumissions =="
# J1 : 1GK/5DEF/4MIL/3ATT, conteste 12320 à 30
bid $J1 '{"leagueId":24,"bids":[{"playerId":12402,"amount":10},{"playerId":12320,"amount":30},{"playerId":12321,"amount":9},{"playerId":12322,"amount":9},{"playerId":12323,"amount":8},{"playerId":12324,"amount":8},{"playerId":12325,"amount":8},{"playerId":12326,"amount":8},{"playerId":12327,"amount":8},{"playerId":12328,"amount":8},{"playerId":12329,"amount":8},{"playerId":12330,"amount":8},{"playerId":12331,"amount":8}]}'
# J2 : 1GK/5DEF/4MIL/3ATT, conteste 12320 à 30 (égalité)
bid $J2 '{"leagueId":24,"bids":[{"playerId":12403,"amount":10},{"playerId":12320,"amount":30},{"playerId":12334,"amount":9},{"playerId":12335,"amount":9},{"playerId":12336,"amount":8},{"playerId":12337,"amount":8},{"playerId":12339,"amount":8},{"playerId":12340,"amount":8},{"playerId":12341,"amount":8},{"playerId":12342,"amount":8},{"playerId":12343,"amount":8},{"playerId":12344,"amount":8},{"playerId":12345,"amount":8}]}'
# J3 : 1GK/4DEF/3MIL/5ATT (excès 1 ATT)
bid $J3 '{"leagueId":24,"bids":[{"playerId":12404,"amount":10},{"playerId":12348,"amount":10},{"playerId":12349,"amount":10},{"playerId":12350,"amount":5},{"playerId":12351,"amount":5},{"playerId":12353,"amount":10},{"playerId":12354,"amount":10},{"playerId":12355,"amount":5},{"playerId":12357,"amount":25},{"playerId":12358,"amount":10},{"playerId":12359,"amount":10},{"playerId":12399,"amount":10},{"playerId":12400,"amount":10}]}'
# J4 : SANS GARDIEN, 6DEF/4MIL/3ATT
bid $J4 '{"leagueId":24,"bids":[{"playerId":12362,"amount":20},{"playerId":12363,"amount":10},{"playerId":12364,"amount":10},{"playerId":12365,"amount":10},{"playerId":12366,"amount":10},{"playerId":12376,"amount":10},{"playerId":12367,"amount":10},{"playerId":12368,"amount":10},{"playerId":12369,"amount":10},{"playerId":12370,"amount":10},{"playerId":12371,"amount":5},{"playerId":12372,"amount":5},{"playerId":12373,"amount":10}]}'

echo "== TOUR 1 : close + resolve =="
adm '{"action":"close-round","leagueId":24}'
adm '{"action":"resolve-round","leagueId":24}'

echo "== ETAT participants apres T1 =="
api_get $AD "/api/admin/auction?leagueId=24" | jq -c '.participants[]|{u:.userName,won:.playersWon,budget:.budget,need:.playersNeeded,errs:.rosterErrors}'
echo "-- retraits T1 --"
api_get $AD "/api/admin/auction?leagueId=24" | jq -c '.results.removals[]|{u:.userId,p:.playerName,amt:.amount,why:.reason}'
echo "-- egalites T1 --"
api_get $AD "/api/admin/auction?leagueId=24" | jq -c '.results.ties[]?|{p:.playerName,amt:.amount,users:.userIds}'

echo "== TOUR 2 : open + complements =="
adm '{"action":"open","leagueId":24}'
bid $J1 '{"leagueId":24,"bids":[{"playerId":12377,"amount":10}]}'
bid $J2 '{"leagueId":24,"bids":[{"playerId":12381,"amount":10}]}'
bid $J3 '{"leagueId":24,"bids":[{"playerId":12385,"amount":80}]}'
bid $J4 '{"leagueId":24,"bids":[{"playerId":12405,"amount":15}]}'
adm '{"action":"close-round","leagueId":24}'
adm '{"action":"resolve-round","leagueId":24}'
echo "== ETAT participants apres T2 =="
api_get $AD "/api/admin/auction?leagueId=24" | jq -c '.participants[]|{u:.userName,won:.playersWon,budget:.budget,need:.playersNeeded,errs:.rosterErrors,missing:.missingLines}'
echo "-- retraits T2 --"
api_get $AD "/api/admin/auction?leagueId=24" | jq -c '.results.removals[]|{u:.userId,p:.playerName,amt:.amount,why:.reason}'
