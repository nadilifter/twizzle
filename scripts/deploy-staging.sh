#!/bin/bash

# Deploy to Staging Environment
# Run this script from your local machine to deploy to upliftergymnastics.com
# Requires: SSH config entry for 'uplifter-staging' (see setup instructions)

set -e

# Configuration
SSH_HOST="uplifter-staging"
REMOTE_DIR="/home/ec2-user/uplifter"
BRANCH="${1:-main}"

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
echo "   Uplifter Staging Deployment"
echo "   Target: upliftergymnastics.com"
echo "========================================"
echo ""

# Check SSH connection
log_step "Checking SSH connection..."
if ! ssh -o ConnectTimeout=5 "$SSH_HOST" "echo 'connected'" > /dev/null 2>&1; then
    log_error "Cannot connect to $SSH_HOST"
    log_info "Make sure your SSH config is set up correctly:"
    log_info "  Host uplifter-staging"
    log_info "    HostName 54.92.161.196"
    log_info "    User ec2-user"
    log_info "    IdentityFile ~/.ssh/uplifter-staging.pem"
    exit 1
fi
log_info "SSH connection successful"

# Run deployment on remote server
log_step "Starting deployment on staging server..."
ssh "$SSH_HOST" << 'ENDSSH'
set -e

cd ~/uplifter || { echo "Project directory not found. Run setup-ec2.sh first."; exit 1; }

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

echo ""
# Check if git is configured correctly
log_info "Checking git configuration..."
REMOTE_URL=$(git remote get-url origin 2>/dev/null || echo "none")
if [[ "$REMOTE_URL" == *"https://"* ]] || [[ "$REMOTE_URL" == "none" ]]; then
    log_warn "Git remote is using HTTPS or not configured"
    log_info "Setting up SSH remote..."
    git remote set-url origin git@github.com:akarzelkc/leapfrog.git || \
        git remote add origin git@github.com:akarzelkc/leapfrog.git
fi

log_info "Pulling latest changes from GitHub..."
if ! git fetch origin 2>/dev/null; then
    log_error "Git fetch failed! Is the deploy key configured?"
    log_info "Run 'setup-github-deploy-key.sh' on the server to set up GitHub access"
    exit 1
fi
git reset --hard origin/main

log_info "Building Docker image..."
sudo docker build -t uplifter:latest .

log_info "Running database migrations..."
# Source environment variables
set -a
source ~/.env.uplifter
set +a

# Run migrations using the container (pin to Prisma 6 to match project version)
# Use the network created by docker-compose (prefixed with directory name)
sudo docker run --rm \
    --network uplifter_uplifter-network \
    -e DATABASE_URL="postgresql://uplifter:${POSTGRES_PASSWORD}@uplifter-postgres:5432/uplifter" \
    uplifter:latest \
    npx prisma@^6 migrate deploy

log_info "Restarting application..."
cd ~/uplifter
sudo docker compose -f docker-compose.staging.yml up -d app

log_info "Waiting for application to start..."
sleep 10

log_info "Checking application health..."
MAX_RETRIES=10
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -sf "http://localhost:3000/api/health" > /dev/null 2>&1; then
        log_info "Health check passed!"
        break
    fi
    
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
        log_warn "Health check failed, retrying... ($RETRY_COUNT/$MAX_RETRIES)"
        sleep 3
    fi
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    log_warn "Health check failed after $MAX_RETRIES attempts"
    log_info "Container logs:"
    sudo docker logs --tail 30 uplifter-app
    exit 1
fi

echo ""
log_info "Deployment successful!"
sudo docker ps --filter "name=uplifter" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
ENDSSH

echo ""
log_info "Staging deployment complete!"
log_info "Site: https://upliftergymnastics.com"
echo ""
