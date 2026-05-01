#!/usr/bin/env bash
#
# Zero-downtime rollover deploy for dev EC2.
#
# Invoked by .github/workflows/deploy-dev.yml via SSM after the new image has
# been pulled from ECR. Flips traffic between app-blue and app-green by
# rewriting /etc/nginx/uplifter-upstream.conf and reloading nginx.
#
# Required env vars (inherited from the workflow / AWS Secrets Manager):
#   IMAGE_URI              Full ECR URI of the new image (e.g. <acct>.dkr.ecr.us-east-1.amazonaws.com/us-clubs/application:dev-abc123)
#   POSTGRES_PASSWORD      Used by docker-compose for the postgres service and to
#                          construct the in-Docker-network DATABASE_URL for migrations
#   ...plus all other runtime secrets consumed by docker-compose.dev.yml

set -euo pipefail

# --- self-reexec under flock so concurrent SSM invocations are serialized ---
LOCK_FILE="/var/run/uplifter-deploy.lock"
if [[ "${UPLIFTER_DEPLOY_LOCKED:-}" != "1" ]]; then
  export UPLIFTER_DEPLOY_LOCKED=1
  exec flock -n "$LOCK_FILE" "$0" "$@" || {
    echo "ERROR: another deploy is already in progress (holding $LOCK_FILE)"
    exit 1
  }
fi

# --- config ---
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.dev.yml}"
UPSTREAM_CONF="${UPSTREAM_CONF:-/etc/nginx/uplifter-upstream.conf}"
BACKUP_DIR="${BACKUP_DIR:-/home/ec2-user/uplifter-backups}"
HEALTH_URL_TEMPLATE="http://127.0.0.1:%s/api/health"
PUBLIC_HEALTH_URL="${PUBLIC_HEALTH_URL:-https://upliftergymnastics-dev.com/api/health}"
BLUE_PORT=3001
GREEN_PORT=3002
HEALTH_TIMEOUT_SECONDS=120
DRAIN_SECONDS=60
TS="$(date +%Y%m%d-%H%M%S)"

log() { printf '=== [%s] %s ===\n' "$(date +%H:%M:%S)" "$*"; }

# --- detect compose binary (v2 preferred, fall back to v1) ---
if docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE=(docker-compose)
else
  echo "ERROR: neither 'docker compose' (v2) nor 'docker-compose' (v1) is available"
  exit 1
fi
compose() { "${COMPOSE[@]}" -f "$COMPOSE_FILE" "$@"; }

# --- ensure IMAGE_URI is set ---
: "${IMAGE_URI:?IMAGE_URI must be set (full ECR URI of new image)}"

# --- preserve rollback tag, then point uplifter:latest at the new image ---
log "Preserving rollback image (uplifter:latest -> uplifter:previous) if present"
if docker image inspect uplifter:latest >/dev/null 2>&1; then
  docker tag uplifter:latest uplifter:previous
fi
log "Tagging new image as uplifter:latest ($IMAGE_URI)"
docker tag "$IMAGE_URI" uplifter:latest

# --- determine active / inactive slots ---
log "Detecting active slot from $UPSTREAM_CONF"
ACTIVE_PORT=""
if [[ -f "$UPSTREAM_CONF" ]]; then
  ACTIVE_PORT="$(sed -nE 's/.*127\.0\.0\.1:([0-9]+).*/\1/p' "$UPSTREAM_CONF" | head -1)"
fi

case "$ACTIVE_PORT" in
  "$BLUE_PORT")
    OLD_SLOT=blue;  OLD_PORT=$BLUE_PORT
    NEW_SLOT=green; NEW_PORT=$GREEN_PORT
    ;;
  "$GREEN_PORT")
    OLD_SLOT=green; OLD_PORT=$GREEN_PORT
    NEW_SLOT=blue;  NEW_PORT=$BLUE_PORT
    ;;
  "")
    # First run — bootstrap onto blue.
    log "No active slot detected (missing $UPSTREAM_CONF). Bootstrapping to blue."
    OLD_SLOT=""; OLD_PORT=""
    NEW_SLOT=blue; NEW_PORT=$BLUE_PORT
    ;;
  *)
    echo "ERROR: $UPSTREAM_CONF references unexpected port '$ACTIVE_PORT' (expected $BLUE_PORT or $GREEN_PORT)"
    exit 1
    ;;
esac
log "Active slot: ${OLD_SLOT:-<none>} (port ${OLD_PORT:-n/a}) -> promoting $NEW_SLOT (port $NEW_PORT)"

# --- postgres up + healthy ---
log "Ensuring postgres is running"
compose up -d postgres
log "Waiting for postgres to accept connections"
for i in $(seq 1 30); do
  if compose exec -T postgres pg_isready -U uplifter -d uplifter >/dev/null 2>&1; then
    log "postgres ready"
    break
  fi
  [[ $i -eq 30 ]] && { echo "ERROR: postgres did not become healthy in 60s"; exit 1; }
  sleep 2
done

# --- pre-migration DB snapshot (dev DB is small; keep last 5) ---
log "Taking pre-migration DB snapshot"
mkdir -p "$BACKUP_DIR"
DUMP_PATH="$BACKUP_DIR/pre-deploy-$TS.sql.gz"
if compose exec -T postgres pg_dump -U uplifter uplifter | gzip > "$DUMP_PATH"; then
  log "Snapshot written to $DUMP_PATH ($(du -h "$DUMP_PATH" | cut -f1))"
else
  rm -f "$DUMP_PATH"
  echo "ERROR: pg_dump failed; aborting before migrations"
  exit 1
fi
# Prune to last 5 snapshots
ls -1t "$BACKUP_DIR"/pre-deploy-*.sql.gz 2>/dev/null | tail -n +6 | xargs -r rm -f

# --- migrations (additive only; old container still serving) ---
log "Running prisma migrate deploy"
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD must be set to run migrations}"
MIGRATE_DATABASE_URL="postgresql://uplifter:${POSTGRES_PASSWORD}@uplifter-postgres:5432/uplifter"
run_migrations() {
  docker run --rm \
    --network uplifter-network \
    -e DATABASE_URL="$MIGRATE_DATABASE_URL" \
    uplifter:latest \
    prisma migrate deploy
}
if ! run_migrations; then
  log "Migration failed; sleeping 10s and retrying once"
  sleep 10
  run_migrations
fi

# --- start the inactive slot ---
log "Starting app-$NEW_SLOT"
compose up -d "app-$NEW_SLOT"

# --- poll health on the new slot ---
HEALTH_URL="$(printf "$HEALTH_URL_TEMPLATE" "$NEW_PORT")"
log "Polling $HEALTH_URL (timeout ${HEALTH_TIMEOUT_SECONDS}s)"
healthy=0
deadline=$(( $(date +%s) + HEALTH_TIMEOUT_SECONDS ))
while [[ $(date +%s) -lt $deadline ]]; do
  if curl -fs --max-time 5 -o /dev/null "$HEALTH_URL" 2>/dev/null; then
    healthy=1
    break
  fi
  sleep 2
done
if [[ $healthy -ne 1 ]]; then
  echo "ERROR: app-$NEW_SLOT did not become healthy within ${HEALTH_TIMEOUT_SECONDS}s"
  log "Stopping failed app-$NEW_SLOT (keeping app-$OLD_SLOT active)"
  compose stop "app-$NEW_SLOT" || true
  exit 1
fi
log "app-$NEW_SLOT is healthy"

# --- atomic nginx upstream swap ---
log "Swapping nginx upstream -> 127.0.0.1:$NEW_PORT"
if [[ -f "$UPSTREAM_CONF" ]]; then
  cp -p "$UPSTREAM_CONF" "$UPSTREAM_CONF.bak.$TS"
fi
printf 'server 127.0.0.1:%s;\n' "$NEW_PORT" > "$UPSTREAM_CONF.new"
mv -f "$UPSTREAM_CONF.new" "$UPSTREAM_CONF"
if ! nginx -t >/tmp/nginx-t.log 2>&1; then
  echo "ERROR: nginx config test failed after upstream swap:"
  cat /tmp/nginx-t.log
  # Roll the include back so nginx isn't left in a bad state.
  if [[ -f "$UPSTREAM_CONF.bak.$TS" ]]; then
    mv -f "$UPSTREAM_CONF.bak.$TS" "$UPSTREAM_CONF"
  fi
  compose stop "app-$NEW_SLOT" || true
  exit 1
fi
nginx -s reload
log "nginx reloaded; public traffic now on app-$NEW_SLOT"

# Prune include backups to last 5.
ls -1t "$UPSTREAM_CONF".bak.* 2>/dev/null | tail -n +6 | xargs -r rm -f

# --- drain + stop old slot (if there was one) ---
if [[ -n "$OLD_SLOT" ]]; then
  log "Draining app-$OLD_SLOT for ${DRAIN_SECONDS}s"
  sleep "$DRAIN_SECONDS"
  log "Stopping app-$OLD_SLOT (SIGTERM, 330s grace for in-flight crons)"
  compose stop "app-$OLD_SLOT"
fi

# --- cron container (ensure it's up; it's profile-less in compose) ---
log "Ensuring cron container is running"
compose up -d cron

# --- image hygiene (dangling only; not system prune -af) ---
log "Pruning dangling images"
docker image prune -f >/dev/null

# --- final public smoke test ---
log "Public smoke test: $PUBLIC_HEALTH_URL"
if ! curl --fail --max-time 15 -o /dev/null -sS "$PUBLIC_HEALTH_URL"; then
  echo "ERROR: public smoke test failed on $PUBLIC_HEALTH_URL after cutover"
  exit 1
fi

log "Deploy complete. Active slot: $NEW_SLOT (port $NEW_PORT)"
