#!/bin/bash
# Decrypt .env.enc to .env for local development
# Requires: sops, age, and the age private key in ~/.config/sops/age/keys.txt

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

export SOPS_AGE_KEY_FILE="${SOPS_AGE_KEY_FILE:-$HOME/.config/sops/age/keys.txt}"

if [ ! -f "$SOPS_AGE_KEY_FILE" ]; then
    echo "Error: Age key not found at $SOPS_AGE_KEY_FILE"
    echo "Please obtain the team's age key and save it to that location."
    exit 1
fi

if [ ! -f "$PROJECT_ROOT/.env.enc" ]; then
    echo "Error: .env.enc not found. Nothing to decrypt."
    exit 1
fi

echo "Decrypting .env.enc -> .env"
sops --config /dev/null \
    --decrypt \
    --input-type dotenv \
    --output-type dotenv \
    "$PROJECT_ROOT/.env.enc" > "$PROJECT_ROOT/.env"

echo "✓ Decrypted .env file created"
