#!/usr/bin/env bash
#
# Manual rollback for dev EC2 after a deploy that passed /api/health but
# misbehaves once live (e.g. subtle regression that the smoke test missed).
#
# Actions:
#   1. Find the most recent /etc/nginx/uplifter-upstream.conf.bak.* and restore it.
#   2. `nginx -t && nginx -s reload` — flip traffic back to the prior slot.
#   3. Point uplifter:latest at uplifter:previous (preserved by deploy-rollover.sh).
#   4. Bring the prior slot back up on that image and wait for health.
#
# This is safe to run multiple times; it's a no-op if already on the prior slot.

set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.dev.yml}"
UPSTREAM_CONF="${UPSTREAM_CONF:-/etc/nginx/uplifter-upstream.conf}"
BLUE_PORT=3001
GREEN_PORT=3002
HEALTH_TIMEOUT_SECONDS=120

log() { printf '=== [%s] %s ===\n' "$(date +%H:%M:%S)" "$*"; }

if docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE=(docker-compose)
else
  echo "ERROR: neither 'docker compose' nor 'docker-compose' is available"
  exit 1
fi
compose() { "${COMPOSE[@]}" -f "$COMPOSE_FILE" "$@"; }

# --- restore the previous upstream include ---
latest_bak="$(ls -1t "$UPSTREAM_CONF".bak.* 2>/dev/null | head -1 || true)"
if [[ -z "$latest_bak" ]]; then
  echo "ERROR: no $UPSTREAM_CONF.bak.* backups found; cannot determine prior port"
  exit 1
fi
log "Restoring upstream from $latest_bak"
cp -p "$latest_bak" "$UPSTREAM_CONF"

if ! nginx -t >/tmp/nginx-t.log 2>&1; then
  echo "ERROR: nginx config test failed after restore:"
  cat /tmp/nginx-t.log
  exit 1
fi
nginx -s reload
log "nginx reloaded"

PRIOR_PORT="$(sed -nE 's/.*127\.0\.0\.1:([0-9]+).*/\1/p' "$UPSTREAM_CONF" | head -1)"
case "$PRIOR_PORT" in
  "$BLUE_PORT")  PRIOR_SLOT=blue ;;
  "$GREEN_PORT") PRIOR_SLOT=green ;;
  *) echo "ERROR: restored upstream has unexpected port '$PRIOR_PORT'"; exit 1 ;;
esac
log "Rolled traffic back to app-$PRIOR_SLOT (port $PRIOR_PORT)"

# --- restore previous image under the :latest tag ---
if docker image inspect uplifter:previous >/dev/null 2>&1; then
  log "Pointing uplifter:latest at uplifter:previous"
  docker tag uplifter:previous uplifter:latest
else
  log "WARNING: no uplifter:previous image tag; leaving uplifter:latest as-is"
fi

# --- bring prior slot back up (no-op if it's already running) ---
log "Starting app-$PRIOR_SLOT"
compose up -d "app-$PRIOR_SLOT"

HEALTH_URL="http://127.0.0.1:$PRIOR_PORT/api/health"
log "Polling $HEALTH_URL"
deadline=$(( $(date +%s) + HEALTH_TIMEOUT_SECONDS ))
while [[ $(date +%s) -lt $deadline ]]; do
  if curl -fsS --max-time 5 -o /dev/null "$HEALTH_URL" 2>/dev/null; then
    log "app-$PRIOR_SLOT healthy on port $PRIOR_PORT"
    log "Rollback complete."
    exit 0
  fi
  sleep 2
done

echo "ERROR: app-$PRIOR_SLOT did not become healthy within ${HEALTH_TIMEOUT_SECONDS}s after rollback"
exit 1
