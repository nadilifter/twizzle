#!/usr/bin/env bash
#
# Restore the dev Postgres container from a snapshot taken by deploy-rollover.sh.
# Run this ON the dev EC2 host. Refuses to run anywhere else.
#
# Pairs with the pre-migration pg_dump in scripts/deploy-rollover.sh, which
# writes pre-deploy-<TS>.sql.gz files into ~/uplifter-backups/ (last 5 kept)
# before each rollover deploy.
#
# Usage:
#   ./scripts/restore-dev-db.sh                       # restore most recent snapshot
#   ./scripts/restore-dev-db.sh <path/to/snapshot>    # restore a specific snapshot
#   ./scripts/restore-dev-db.sh --list                # list available snapshots
#   ./scripts/restore-dev-db.sh --yes                 # skip the confirmation prompt
#
# Safety guards (ALL must pass before anything destructive happens):
#   1. ~/.env.uplifter exists and declares APP_ENVIRONMENT=development
#   2. DATABASE_URL (if set) does NOT contain '.rds.amazonaws.com'
#   3. A local container named 'uplifter-postgres' is running
#   4. User types 'restore dev db' to confirm (or passes --yes)
#
# The snapshots from deploy-rollover.sh are plain pg_dump output (no --clean),
# so this script drops and recreates the uplifter database before piping the
# dump in. App containers are stopped during the restore so nothing writes
# mid-flight.

set -euo pipefail

ENV_FILE="${ENV_FILE:-$HOME/.env.uplifter}"
SNAPSHOT_DIR="${SNAPSHOT_DIR:-$HOME/uplifter-backups}"
SNAPSHOT_GLOB="${SNAPSHOT_GLOB:-pre-deploy-*.sql.gz}"
COMPOSE_FILE="${COMPOSE_FILE:-$HOME/uplifter/docker-compose.dev.yml}"
ASSUME_YES=0
LIST_ONLY=0
SNAPSHOT_ARG=""

log() { printf '=== %s ===\n' "$*"; }
err() { printf 'ERROR: %s\n' "$*" >&2; }

usage() {
    sed -n '2,25p' "$0" | sed 's/^# \{0,1\}//'
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        --yes|-y) ASSUME_YES=1; shift ;;
        --list)   LIST_ONLY=1; shift ;;
        -h|--help) usage; exit 0 ;;
        -*) err "unknown flag: $1"; usage; exit 1 ;;
        *) SNAPSHOT_ARG="$1"; shift ;;
    esac
done

if [[ "$LIST_ONLY" == 1 ]]; then
    log "Snapshots in $SNAPSHOT_DIR"
    ls -lh "$SNAPSHOT_DIR"/$SNAPSHOT_GLOB 2>/dev/null || echo "(none)"
    exit 0
fi

# --- Guard 1: env file declares dev ---
if [[ ! -f "$ENV_FILE" ]]; then
    err "$ENV_FILE not found — refusing to run (this script is dev-only)"
    exit 1
fi
# shellcheck disable=SC1090
set -a; source "$ENV_FILE"; set +a

if [[ "${APP_ENVIRONMENT:-}" != "development" ]]; then
    err "APP_ENVIRONMENT='${APP_ENVIRONMENT:-}' (expected 'development') — refusing to run"
    exit 1
fi

# --- Guard 2: not pointed at RDS ---
if [[ "${DATABASE_URL:-}" == *.rds.amazonaws.com* ]]; then
    err "DATABASE_URL points at RDS — this script restores a local Postgres container only"
    exit 1
fi

# --- Guard 3: local uplifter-postgres container running ---
if ! sudo docker ps --format '{{.Names}}' | grep -qx uplifter-postgres; then
    err "container 'uplifter-postgres' is not running locally — refusing to run"
    exit 1
fi

# --- Pick snapshot ---
if [[ -n "$SNAPSHOT_ARG" ]]; then
    SNAPSHOT="$SNAPSHOT_ARG"
else
    SNAPSHOT=$(ls -1t "$SNAPSHOT_DIR"/$SNAPSHOT_GLOB 2>/dev/null | head -1 || true)
fi
if [[ -z "${SNAPSHOT:-}" || ! -f "$SNAPSHOT" ]]; then
    err "no snapshot file found (looked at: ${SNAPSHOT:-$SNAPSHOT_DIR/$SNAPSHOT_GLOB})"
    err "run with --list to see available snapshots"
    exit 1
fi

log "Will restore: $SNAPSHOT ($(du -h "$SNAPSHOT" | cut -f1))"
log "Target:       uplifter-postgres on $(hostname) (APP_ENVIRONMENT=$APP_ENVIRONMENT)"

# --- Guard 4: explicit confirmation ---
if [[ "$ASSUME_YES" != 1 ]]; then
    read -r -p "Type 'restore dev db' to proceed: " CONFIRM
    if [[ "$CONFIRM" != "restore dev db" ]]; then
        err "confirmation phrase mismatch — aborting"
        exit 1
    fi
fi

# --- Stop app containers so nothing writes during restore ---
APP_CONTAINERS=$(sudo docker ps --format '{{.Names}}' | grep -E '^uplifter-app' || true)
if [[ -n "$APP_CONTAINERS" ]]; then
    log "Stopping app containers: $APP_CONTAINERS"
    echo "$APP_CONTAINERS" | xargs -r sudo docker stop
fi

# --- Drop + recreate uplifter database (rollover snapshots have no DROP) ---
# Connect to the 'postgres' system DB so we can drop 'uplifter'. Terminate any
# leftover sessions first or DROP DATABASE will fail with an in-use error.
log "Recreating uplifter database"
sudo docker exec -i -e PGPASSWORD="$POSTGRES_PASSWORD" uplifter-postgres \
    psql -U uplifter -d postgres -v ON_ERROR_STOP=1 <<'SQL'
SELECT pg_terminate_backend(pid)
  FROM pg_stat_activity
 WHERE datname = 'uplifter' AND pid <> pg_backend_pid();
DROP DATABASE IF EXISTS uplifter;
CREATE DATABASE uplifter OWNER uplifter;
SQL

# --- Restore ---
log "Restoring snapshot into uplifter-postgres"
if ! ( set -o pipefail; gunzip -c "$SNAPSHOT" | sudo docker exec -i \
        -e PGPASSWORD="$POSTGRES_PASSWORD" uplifter-postgres \
        psql -U uplifter -d uplifter -v ON_ERROR_STOP=1 ); then
    err "psql restore failed — DB may be in a partial state. Inspect uplifter-postgres before retrying."
    exit 1
fi

log "Restore complete."
log "Bring app back with: sudo docker compose -f $COMPOSE_FILE up -d"
