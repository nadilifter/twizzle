#!/bin/bash
# Edit encrypted secrets in-place
# Requires: sops, age, and the age private key

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

export SOPS_AGE_KEY_FILE="${SOPS_AGE_KEY_FILE:-$HOME/.config/sops/age/keys.txt}"

# Age public key for re-encryption
AGE_RECIPIENTS="age1e0tvgeha98njjn7c6wgnr5cc3ggh06y3m3xckexrm33up6z82a6s97fld7"

if [ ! -f "$SOPS_AGE_KEY_FILE" ]; then
    echo "Error: Age key not found at $SOPS_AGE_KEY_FILE"
    exit 1
fi

if [ ! -f "$PROJECT_ROOT/.env.enc" ]; then
    echo "Error: .env.enc not found."
    exit 1
fi

echo "Opening encrypted .env.enc in editor..."
sops --config /dev/null \
    --input-type dotenv \
    --output-type dotenv \
    --age "$AGE_RECIPIENTS" \
    "$PROJECT_ROOT/.env.enc"

echo "✓ Changes saved to .env.enc"
