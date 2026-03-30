#!/bin/bash

# Setup GitHub Deploy Key for Staging Server
# Run this on the EC2 instance to enable git pull from GitHub
# Usage: ./scripts/setup-github-deploy-key.sh
#
# This script:
# 1. Generates an SSH deploy key (ed25519)
# 2. Configures SSH to use it for GitHub
# 3. Updates the git remote to use SSH
# 4. Displays the public key to add to GitHub

set -e

# Configuration
GITHUB_REPO="uplifter-us/clubs"
KEY_FILE="$HOME/.ssh/github_deploy_key"
PROJECT_DIR="$HOME/uplifter"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step() { echo -e "${BLUE}[STEP]${NC} $1"; }

echo ""
echo "========================================"
echo "   GitHub Deploy Key Setup"
echo "   Repository: $GITHUB_REPO"
echo "========================================"
echo ""

# Ensure .ssh directory exists
mkdir -p ~/.ssh
chmod 700 ~/.ssh

# Generate deploy key if it doesn't exist
if [ -f "$KEY_FILE" ]; then
    log_info "Deploy key already exists at $KEY_FILE"
    
    read -p "Do you want to regenerate it? (y/N): " REGEN
    if [[ "$REGEN" =~ ^[Yy]$ ]]; then
        rm -f "$KEY_FILE" "$KEY_FILE.pub"
        log_info "Removed old key, generating new one..."
    else
        log_info "Using existing key"
    fi
fi

if [ ! -f "$KEY_FILE" ]; then
    log_step "Generating SSH deploy key..."
    ssh-keygen -t ed25519 -f "$KEY_FILE" -N "" -C "uplifter-staging-deploy-$(date +%Y%m%d)"
    chmod 600 "$KEY_FILE"
    chmod 644 "$KEY_FILE.pub"
    log_info "Deploy key generated"
fi

# Configure SSH to use this key for GitHub
log_step "Configuring SSH for GitHub..."

# Check if GitHub config already exists
if grep -q "github.com" ~/.ssh/config 2>/dev/null; then
    log_info "GitHub SSH config already exists, updating..."
    # Remove existing GitHub config
    sed -i '/# GitHub deploy key/,/IdentitiesOnly yes/d' ~/.ssh/config 2>/dev/null || true
fi

# Add GitHub SSH config
cat >> ~/.ssh/config << EOF

# GitHub deploy key for Uplifter
Host github.com
    HostName github.com
    User git
    IdentityFile $KEY_FILE
    IdentitiesOnly yes
EOF

chmod 600 ~/.ssh/config
log_info "SSH config updated"

# Display the public key
echo ""
echo "========================================"
log_warn "ADD THIS DEPLOY KEY TO GITHUB"
echo "========================================"
echo ""
log_info "1. Go to: https://github.com/$GITHUB_REPO/settings/keys"
log_info "2. Click 'Add deploy key'"
log_info "3. Title: uplifter-staging"
log_info "4. Paste this public key:"
echo ""
echo "----------------------------------------"
cat "$KEY_FILE.pub"
echo "----------------------------------------"
echo ""
log_warn "After adding the key to GitHub, press Enter to continue..."
read -r

# Test the connection
log_step "Testing GitHub SSH connection..."
if ssh -o StrictHostKeyChecking=accept-new -T git@github.com 2>&1 | grep -q "successfully authenticated"; then
    log_info "GitHub SSH connection successful!"
else
    # GitHub returns exit code 1 even on success, check the message
    SSH_OUTPUT=$(ssh -o StrictHostKeyChecking=accept-new -T git@github.com 2>&1 || true)
    if echo "$SSH_OUTPUT" | grep -q "successfully authenticated"; then
        log_info "GitHub SSH connection successful!"
    else
        log_error "GitHub SSH connection failed!"
        log_error "Output: $SSH_OUTPUT"
        log_info ""
        log_info "Make sure you've added the deploy key to GitHub."
        log_info "The key should be at: https://github.com/$GITHUB_REPO/settings/keys"
        exit 1
    fi
fi

# Update git remote to use SSH
if [ -d "$PROJECT_DIR/.git" ]; then
    log_step "Updating git remote to use SSH..."
    cd "$PROJECT_DIR"
    
    CURRENT_REMOTE=$(git remote get-url origin 2>/dev/null || echo "none")
    NEW_REMOTE="git@github.com:$GITHUB_REPO.git"
    
    if [ "$CURRENT_REMOTE" != "$NEW_REMOTE" ]; then
        git remote set-url origin "$NEW_REMOTE"
        log_info "Updated remote from: $CURRENT_REMOTE"
        log_info "                 to: $NEW_REMOTE"
    else
        log_info "Remote already configured correctly: $NEW_REMOTE"
    fi
    
    # Verify we can fetch
    log_step "Testing git fetch..."
    if git fetch origin 2>&1; then
        log_info "Git fetch successful!"
    else
        log_error "Git fetch failed. Check the deploy key permissions."
        exit 1
    fi
else
    log_warn "Project directory not found at $PROJECT_DIR"
    log_info "Clone the repository with:"
    log_info "  git clone git@github.com:$GITHUB_REPO.git $PROJECT_DIR"
fi

echo ""
echo "========================================"
log_info "GitHub deploy key setup complete!"
echo "========================================"
echo ""
log_info "You can now deploy using:"
echo "  cd $PROJECT_DIR && ./deploy.sh"
echo ""
log_info "Or from your local machine:"
echo "  ./scripts/deploy-staging.sh"
echo ""
