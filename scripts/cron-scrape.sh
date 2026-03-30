#!/bin/bash
# Automated matchday scraping - runs via cron on VPS
# Cron: 0 8 * * 1  (Monday 8:00 AM, after L'Equipe publishes notes)
#
# What it does:
#   1. Auto-detects the current matchday (latest scored day in DB)
#   2. Runs process-matchday.ts to scrape L'Equipe + inject scores
#   3. Logs everything to /opt/la-ligue-enchantee/tmp/cron-scrape.log

set -euo pipefail

APP_DIR="/opt/la-ligue-enchantee"
LOG_DIR="$APP_DIR/tmp"
LOG_FILE="$LOG_DIR/cron-scrape.log"
LOCK_FILE="$LOG_DIR/cron-scrape.lock"
export PATH="/usr/local/bin:/usr/bin:/bin:$HOME/.nvm/versions/node/$(ls $HOME/.nvm/versions/node/ 2>/dev/null | tail -1)/bin:$PATH"

mkdir -p "$LOG_DIR"

# Prevent concurrent runs
if [ -f "$LOCK_FILE" ]; then
  echo "$(date '+%F %T') SKIP: lock file exists, another run in progress" >> "$LOG_FILE"
  exit 0
fi
trap 'rm -f "$LOCK_FILE"' EXIT
touch "$LOCK_FILE"

cd "$APP_DIR"

echo "" >> "$LOG_FILE"
echo "========================================" >> "$LOG_FILE"
echo "$(date '+%F %T') START cron-scrape" >> "$LOG_FILE"
echo "========================================" >> "$LOG_FILE"

# Auto-detect matchday from DB
MATCHDAY=$(npx tsx scripts/get-current-matchday.ts 2>/dev/null || echo "27")
echo "$(date '+%F %T') Detected matchday: $MATCHDAY" >> "$LOG_FILE"

# Run the pipeline
npx tsx scripts/process-matchday.ts "$MATCHDAY" >> "$LOG_FILE" 2>&1
EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
  echo "$(date '+%F %T') SUCCESS: matchday $MATCHDAY processed" >> "$LOG_FILE"
else
  echo "$(date '+%F %T') ERROR: exit code $EXIT_CODE" >> "$LOG_FILE"
fi

echo "$(date '+%F %T') END cron-scrape" >> "$LOG_FILE"
