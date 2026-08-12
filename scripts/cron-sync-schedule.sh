#!/bin/bash
# Sync match schedule daily from TheSportsDB
# Cron: 0 6 * * * (every day at 6:00 AM, before any deadline)
# Syncs current matchday + 2 next matchdays to catch advances/postponements

set -euo pipefail

APP_DIR="/opt/la-ligue-enchantee"
LOG_FILE="$APP_DIR/tmp/cron-sync-schedule.log"
export PATH="/usr/local/bin:/usr/bin:/bin:$HOME/.nvm/versions/node/$(ls $HOME/.nvm/versions/node/ 2>/dev/null | tail -1)/bin:$PATH"

cd "$APP_DIR"

# get-current-matchday renvoie la derniere journee AVEC scores saisis.
# Tant qu'une journee n'est pas publiee on est en retard d'1 indice ;
# on sync donc sur 3 journees pour garantir que la prochaine a venir est presente.
MATCHDAY=$(./node_modules/.bin/tsx scripts/get-current-matchday.ts 2>/dev/null || echo "29")
END=$((MATCHDAY + 2))

echo "$(date '+%F %T') Syncing J${MATCHDAY}-J${END}" >> "$LOG_FILE"
./node_modules/.bin/tsx scripts/sync-match-schedule.ts "$MATCHDAY" "$END" >> "$LOG_FILE" 2>&1 || echo "$(date '+%F %T') WARN: sync failed" >> "$LOG_FILE"
