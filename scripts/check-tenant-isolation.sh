#!/usr/bin/env bash
# --------------------------------------------------------------------------
# Tenant-isolation static-analysis lint.
#
# Checks API route files for common tenant-isolation mistakes:
#   1. Importing `db` without `getScopedDb` (unless allowlisted)
#   2. Mutations on TENANT_MODELs using only `where: { id }` (check-then-act)
#   3. Reading organizationId from client input instead of session
#
# Usage:
#   pnpm lint:tenant            # check all API routes
#   pnpm lint:tenant --staged   # check only git-staged files (pre-commit)
#
# Exit codes: 0 = clean, 1 = violations found
# --------------------------------------------------------------------------

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ALLOWLIST="$REPO_ROOT/scripts/tenant-isolation-allowlist.txt"
API_DIR="src/app/api"

# Directories whose routes are exempt (webhooks, auth, cron, superadmin, public)
EXEMPT_DIRS="webhooks/ auth/ cron/ superadmin/ public/"

# camelCase names of TENANT_MODELS from src/lib/db.ts
TENANT_MODELS=(
  program event invoice skill lessonPlan announcement websiteConfig
  organizationMember membershipGroup pass discount gLCode ledgerEntry
  product waiver organizationInvitation organizationAthlete medicalFormConfig
  customMedicalQuestion level programInstance transaction payout
  recurringCharge evaluationTemplate achievement message smsCampaign
  conversation smsUsage emailMessage emailCampaign emailUsage media
  facility equipment shift scheduleTemplate registrationQueueConfig
  notificationRule notificationLog competition competitionTeam
  registrationFile certification organizationSport organizationCategoryPreference
)

# Build a grep-friendly alternation of model names
MODEL_ALT=$(IFS="|"; echo "${TENANT_MODELS[*]}")

# ---- Collect files to check ------------------------------------------------

get_files() {
  if [[ "${1:-}" == "--staged" ]]; then
    git -C "$REPO_ROOT" diff --cached --name-only --diff-filter=ACM \
      | grep "^${API_DIR}/.*route\.ts$" || true
  else
    find "$REPO_ROOT/$API_DIR" -name "route.ts" -type f \
      | sed "s|^$REPO_ROOT/||"
  fi
}

FILES=$(get_files "${1:-}")
if [[ -z "$FILES" ]]; then
  echo "lint:tenant — no API route files to check."
  exit 0
fi

# ---- Load allowlist ---------------------------------------------------------

ALLOWED=()
if [[ -f "$ALLOWLIST" ]]; then
  while IFS= read -r line; do
    line="${line%%#*}"       # strip comments
    line="${line// /}"       # strip spaces
    [[ -z "$line" ]] && continue
    ALLOWED+=("$line")
  done < "$ALLOWLIST"
fi

is_allowed() {
  local file="$1"
  for a in "${ALLOWED[@]}"; do
    [[ "$file" == "$a" ]] && return 0
  done
  return 1
}

is_exempt() {
  local file="$1"
  for dir in $EXEMPT_DIRS; do
    [[ "$file" == *"$API_DIR/$dir"* ]] && return 0
  done
  return 1
}

# ---- Checks -----------------------------------------------------------------

VIOLATIONS=0

check_missing_scoped_import() {
  local file="$1"
  local full="$REPO_ROOT/$file"
  # File imports db but not getScopedDb
  if grep -q 'from "@/lib/db"' "$full" \
     && ! grep -q 'getScopedDb' "$full"; then
    echo "  WARN  $file"
    echo "        Imports db without getScopedDb. Use getScopedDb for tenant models."
    VIOLATIONS=$((VIOLATIONS + 1))
  fi
}

check_client_org_id() {
  local file="$1"
  local full="$REPO_ROOT/$file"
  # Look for patterns that read organizationId from client input
  local matches
  matches=$(grep -n \
    -e 'searchParams\.get.*organizationId' \
    -e 'body\.organizationId' \
    -e 'formData\.get.*organizationId' \
    "$full" 2>/dev/null | grep -v 'tenant-isolation-ok' || true)
  if [[ -n "$matches" ]]; then
    while IFS= read -r match; do
      echo "  FAIL  $file"
      echo "        Client-provided organizationId: $match"
      VIOLATIONS=$((VIOLATIONS + 1))
    done <<< "$matches"
  fi
}

check_unscoped_mutations() {
  local file="$1"
  local full="$REPO_ROOT/$file"
  # Look for db.MODEL.update/delete({ where: { id } patterns without organizationId
  # This is a heuristic — looks for `db.MODEL.update({` or `db.MODEL.delete({`
  # where MODEL is a tenant model
  local matches
  matches=$(grep -n -E \
    "db\.(${MODEL_ALT})\.(update|delete)\(" \
    "$full" 2>/dev/null | grep -v 'tenant-isolation-ok' | grep -v 'scopedDb' || true)
  if [[ -n "$matches" ]]; then
    while IFS= read -r match; do
      echo "  WARN  $file"
      echo "        Raw db mutation on tenant model: $match"
      echo "        Prefer scopedDb or add organizationId to where clause."
      VIOLATIONS=$((VIOLATIONS + 1))
    done <<< "$matches"
  fi
}

# ---- Run checks -------------------------------------------------------------

echo ""
echo "=== Tenant Isolation Lint ==="
echo ""

while IFS= read -r file; do
  [[ -z "$file" ]] && continue
  is_exempt "$file" && continue

  # Client-provided organizationId is always a bug, even in allowlisted files
  check_client_org_id "$file"

  # Checks 1 & 2 are suppressed for allowlisted files (already audited)
  if ! is_allowed "$file"; then
    check_missing_scoped_import "$file"
    check_unscoped_mutations "$file"
  fi
done <<< "$FILES"

echo ""
if [[ $VIOLATIONS -gt 0 ]]; then
  echo "Found $VIOLATIONS tenant-isolation issue(s)."
  echo ""
  echo "To fix:"
  echo "  - Use getScopedDb(session.user.organizationId) for tenant model queries"
  echo "  - Never trust client-provided organizationId"
  echo "  - Add // tenant-isolation-ok: <reason> to suppress false positives"
  echo "  - Add the file to scripts/tenant-isolation-allowlist.txt if it legitimately"
  echo "    uses raw db (with a comment explaining why)"
  echo ""
  exit 1
else
  echo "No tenant-isolation issues found."
  echo ""
  exit 0
fi
