#!/bin/bash

# Deploy to Staging Environment
# Run this script from your local machine to deploy to upliftergymnastics.com
# Requires: SSH config entry for 'uplifter-development' (see setup instructions)

set -e

# Configuration
SSH_HOST="uplifter-development"
REMOTE_DIR="/home/ec2-user/uplifter"
BRANCH="${1:-dev}"

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
    log_info "  Host uplifter-development"
    log_info "    HostName 54.92.161.196"
    log_info "    User ec2-user"
    log_info "    IdentityFile ~/.ssh/uplifter-staging.pem"
    exit 1
fi
log_info "SSH connection successful"

# Run deployment on remote server
log_step "Starting deployment on development server..."
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
log_info "Pulling latest changes from GitHub..."
if ! git fetch origin 2>/dev/null; then
    log_error "Git fetch failed! Check credentials or deploy key."
    log_info "For HTTPS: ensure ~/.git-credentials has a valid PAT"
    log_info "For SSH: ensure deploy key is added to the repo"
    exit 1
fi
git reset --hard origin/dev

# Source env vars so NEXT_PUBLIC_* are available as build args
set -a
source ~/.env.uplifter
set +a

log_info "Building Docker image (app stays live during build)..."
sudo DOCKER_BUILDKIT=1 docker build \
    --build-arg APP_ENVIRONMENT=development \
    --build-arg NEXT_PUBLIC_ADYEN_CLIENT_KEY="${NEXT_PUBLIC_ADYEN_CLIENT_KEY}" \
    --build-arg NEXT_PUBLIC_ADYEN_ENVIRONMENT="${NEXT_PUBLIC_ADYEN_ENVIRONMENT}" \
    --build-arg NEXT_PUBLIC_SENTRY_DSN="${NEXT_PUBLIC_SENTRY_DSN}" \
    --build-arg NEXT_PUBLIC_APP_ENVIRONMENT="${NEXT_PUBLIC_APP_ENVIRONMENT}" \
    -t uplifter:new .

log_info "Running database migrations..."

# Ensure PostgreSQL is running before migrations
sudo docker compose -f docker-compose.development.yml up -d postgres
sleep 3

# Run migrations using the new image before swapping
sudo docker run --rm \
    --network uplifter-network \
    -e DATABASE_URL="postgresql://uplifter:${POSTGRES_PASSWORD}@uplifter-postgres:5432/uplifter" \
    uplifter:new \
    prisma migrate deploy

log_info "Swapping to new image..."
sudo docker tag uplifter:new uplifter:latest
cd ~/uplifter
sudo docker compose -f docker-compose.development.yml up -d app

log_info "Waiting for application to start..."
sleep 3

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

# Clean up Docker resources to prevent disk space buildup
log_info "Cleaning up Docker resources..."

# Remove stopped containers (excluding running ones)
STOPPED=$(sudo docker ps -a -f "status=exited" -f "status=created" -q | wc -l)
if [ "$STOPPED" -gt 0 ]; then
    sudo docker container prune -f > /dev/null 2>&1
    log_info "Removed $STOPPED stopped container(s)"
fi

# Remove dangling images (old builds)
DANGLING=$(sudo docker images -f "dangling=true" -q | wc -l)
if [ "$DANGLING" -gt 0 ]; then
    sudo docker image prune -f > /dev/null 2>&1
    log_info "Removed $DANGLING dangling image(s)"
fi

# Prune build cache (keep recent layers + pnpm/next.js caches for faster rebuilds)
CACHE_SIZE=$(sudo docker system df --format '{{.Size}}' | tail -1)
sudo docker builder prune -f --keep-storage 5GB > /dev/null 2>&1
log_info "Pruned build cache (was: $CACHE_SIZE)"

# Remove unused networks
sudo docker network prune -f > /dev/null 2>&1

# Show current disk usage
log_info "Docker disk usage:"
sudo docker system df --format "table {{.Type}}\t{{.Size}}\t{{.Reclaimable}}"

echo ""
log_info "Deployment successful!"
sudo docker ps --filter "name=uplifter" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
ENDSSH

echo ""
log_info "Staging deployment complete!"
log_info "Site: https://upliftergymnastics-dev.com"
echo ""
