#!/bin/bash
# Sync match schedule daily from TheSportsDB
# Cron: 0 6 * * * (every day at 6:00 AM, before any deadline)
# Syncs current matchday + next matchday to catch advances/postponements

set -euo pipefail

APP_DIR="/opt/la-ligue-enchantee"
LOG_FILE="$APP_DIR/tmp/cron-sync-schedule.log"
export PATH="/usr/local/bin:/usr/bin:/bin:$HOME/.nvm/versions/node/$(ls $HOME/.nvm/versions/node/ 2>/dev/null | tail -1)/bin:$PATH"

cd "$APP_DIR"

MATCHDAY=$(npx tsx scripts/get-current-matchday.ts 2>/dev/null || echo "29")
NEXT=$((MATCHDAY + 1))

echo "$(date '+%F %T') Syncing J${MATCHDAY}-J${NEXT}" >> "$LOG_FILE"
npx tsx scripts/sync-match-schedule.ts "$MATCHDAY" "$NEXT" >> "$LOG_FILE" 2>&1 || echo "$(date '+%F %T') WARN: sync failed" >> "$LOG_FILE"
