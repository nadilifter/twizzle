#!/bin/bash
# Adds missing subdomain entries to /etc/hosts for local development.
# Usage: sudo bash scripts/add-hosts.sh

set -euo pipefail

HOSTS_FILE="/etc/hosts"
ENTRIES=(
  "127.0.0.1	login.uplifterinc.localhost"
  "127.0.0.1	startup.uplifterinc.localhost"
  "127.0.0.1	events.uplifterinc.localhost"
  "127.0.0.1	competitions.uplifterinc.localhost"
  "127.0.0.1	results.uplifterinc.localhost"
)

if [ "$(id -u)" -ne 0 ]; then
  echo "Error: Must run as root.  Use: sudo bash $0"
  exit 1
fi

added=0
for entry in "${ENTRIES[@]}"; do
  host=$(echo "$entry" | awk '{print $2}')
  if ! grep -q "$host" "$HOSTS_FILE"; then
    echo "$entry" >> "$HOSTS_FILE"
    echo "  Added: $host"
    ((added++))
  else
    echo "  Already exists: $host"
  fi
done

echo ""
echo "Done. $added new entries added to $HOSTS_FILE."
