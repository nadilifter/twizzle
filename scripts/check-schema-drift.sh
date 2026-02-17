#!/bin/bash
# check-schema-drift.sh
#
# Detects if prisma/schema.prisma has changes that are not reflected in
# the migration history.  Uses `prisma migrate diff` to compare the
# schema file against the current migration history; if the diff
# produces any SQL output, there are un-migrated changes.
#
# Usage:
#   ./scripts/check-schema-drift.sh          # exits 1 on drift
#   pnpm db:check                            # same, via package.json

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

echo "Checking for schema drift..."

# Generate a diff between the migration history and the current schema.
# --from-migrations  = state the database would be in after all migrations
# --to-schema-datamodel = state declared in schema.prisma
# --exit-code        = exit 2 when there IS a diff (non-empty output)
DIFF_OUTPUT=$(npx prisma migrate diff \
  --from-migrations prisma/migrations \
  --to-schema-datamodel prisma/schema.prisma \
  --exit-code 2>&1) || EXIT_CODE=$?

EXIT_CODE=${EXIT_CODE:-0}

if [ "$EXIT_CODE" -eq 2 ]; then
  echo ""
  echo "ERROR: Schema drift detected!"
  echo "The following changes in schema.prisma have no corresponding migration:"
  echo ""
  echo "$DIFF_OUTPUT"
  echo ""
  echo "Run 'pnpm db:migrate' to generate a migration, or if you intentionally"
  echo "want to skip migration generation, set SKIP_SCHEMA_CHECK=1."
  exit 1
elif [ "$EXIT_CODE" -ne 0 ]; then
  echo ""
  echo "WARNING: prisma migrate diff exited with unexpected code $EXIT_CODE"
  echo "$DIFF_OUTPUT"
  exit 1
else
  echo "No schema drift detected. Migrations are up to date."
  exit 0
fi
