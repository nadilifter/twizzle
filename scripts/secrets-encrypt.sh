#!/bin/bash
# Encrypt .env to .env.enc for committing to git
# Requires: sops, age

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Age public key for the team (add more recipients separated by comma for multiple team members)
AGE_RECIPIENTS="age1e0tvgeha98njjn7c6wgnr5cc3ggh06y3m3xckexrm33up6z82a6s97fld7"

if [ ! -f "$PROJECT_ROOT/.env" ]; then
    echo "Error: .env not found. Create one first or copy from .env.example"
    exit 1
fi

echo "Encrypting .env -> .env.enc"
sops --config /dev/null \
    --encrypt \
    --age "$AGE_RECIPIENTS" \
    --input-type dotenv \
    --output-type dotenv \
    "$PROJECT_ROOT/.env" > "$PROJECT_ROOT/.env.enc"

echo "✓ Encrypted .env.enc created - safe to commit to git"
