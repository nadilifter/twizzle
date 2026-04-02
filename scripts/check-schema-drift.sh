#!/bin/bash
# check-schema-drift.sh
#
# Detects if prisma/schema.prisma has changes that are not reflected in
# the migration history by comparing git history — no database required.
#
# In CI (GitHub Actions), compares the PR branch against its base branch.
# Locally, compares the working tree against the last commit.
#
# Exits 1 if schema.prisma was modified without a corresponding new migration.
#
# Usage:
#   ./scripts/check-schema-drift.sh          # exits 1 on drift
#   pnpm db:check                            # same, via package.json

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

echo "Checking for schema drift..."

# Determine the base ref to diff against.
# In GitHub Actions pull_request events, GITHUB_BASE_REF is set to the target branch.
# Locally, fall back to diffing against HEAD (uncommitted changes).
if [ -n "${GITHUB_BASE_REF:-}" ]; then
  BASE_SHA=$(git merge-base HEAD "origin/${GITHUB_BASE_REF}" 2>/dev/null || echo "")
  if [ -z "$BASE_SHA" ]; then
    echo "WARNING: Could not determine merge base against origin/${GITHUB_BASE_REF}. Falling back to HEAD."
    BASE_SHA="HEAD"
  fi
else
  # Local: diff uncommitted changes
  BASE_SHA="HEAD"
fi

# Check if schema.prisma changed since the base
SCHEMA_DIFF=$(git diff "${BASE_SHA}" HEAD -- prisma/schema.prisma 2>/dev/null || git diff -- prisma/schema.prisma)

# Check if any new migration SQL files were added since the base
NEW_MIGRATIONS=$(git diff --name-only "${BASE_SHA}" HEAD -- "prisma/migrations/*.sql" "prisma/migrations/**/*.sql" 2>/dev/null || git diff --name-only -- "prisma/migrations/*.sql" "prisma/migrations/**/*.sql")

if [ -n "$SCHEMA_DIFF" ] && [ -z "$NEW_MIGRATIONS" ]; then
  echo ""
  echo "ERROR: Schema drift detected!"
  echo "prisma/schema.prisma has been modified but no new migration was created."
  echo ""
  echo "Run 'pnpm db:migrate' to generate a migration for these changes:"
  echo ""
  echo "$SCHEMA_DIFF"
  exit 1
elif [ -n "$SCHEMA_DIFF" ] && [ -n "$NEW_MIGRATIONS" ]; then
  echo "Schema changes detected with corresponding migrations:"
  echo "$NEW_MIGRATIONS"
  echo "No drift detected."
  exit 0
else
  echo "No schema changes detected. Migrations are up to date."
  exit 0
fi
