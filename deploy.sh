#!/bin/bash

# Deployment script for Uplifter application on EC2
# This script updates the application from git and rebuilds/runs the Docker container

set -e  # Exit on any error

# Configuration
APP_NAME="uplifter-app"
IMAGE_NAME="uplifter"
PROJECT_DIR="$HOME/uplifter"
ENV_FILE="$HOME/.env.uplifter"
PORT=3000

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

echo "========================================"
echo "    Uplifter Deployment Script"
echo "========================================"
echo ""

# Check for environment file
if [ ! -f "$ENV_FILE" ]; then
    log_error "Environment file not found at $ENV_FILE"
    log_info "Please create the environment file with required variables:"
    log_info "  - DATABASE_URL"
    log_info "  - NEXTAUTH_URL"
    log_info "  - NEXTAUTH_SECRET"
    log_info "  - ADYEN_API_KEY (optional)"
    log_info "  - ADYEN_MERCHANT_ACCOUNT (optional)"
    log_info "  - ADYEN_ENVIRONMENT (TEST or LIVE)"
    log_info "  - UPSTASH_REDIS_REST_URL (optional)"
    log_info "  - UPSTASH_REDIS_REST_TOKEN (optional)"
    exit 1
fi

# Navigate to project directory
cd "$PROJECT_DIR" || { log_error "Project directory not found: $PROJECT_DIR"; exit 1; }

log_info "Starting deployment..."

# Pull latest changes from git
log_info "Pulling latest changes from git..."
git fetch origin
if ! git pull origin main 2>/dev/null; then
    log_warn "Git pull failed, resetting to origin/main..."
    git reset --hard origin/main
fi

# Tag the current image as backup for rollback
log_info "Backing up current image..."
if sudo docker image inspect "$IMAGE_NAME:latest" > /dev/null 2>&1; then
    sudo docker tag "$IMAGE_NAME:latest" "$IMAGE_NAME:previous" || true
fi

# Build new Docker image
log_info "Building Docker image..."
if ! sudo docker build -t "$IMAGE_NAME:latest" .; then
    log_error "Docker build failed!"
    exit 1
fi

# Stop and remove existing container
log_info "Stopping existing container..."
sudo docker stop "$APP_NAME" 2>/dev/null || true
sudo docker rm "$APP_NAME" 2>/dev/null || true

# Run database migrations
log_info "Running database migrations..."
if ! sudo docker run --rm \
    --env-file "$ENV_FILE" \
    "$IMAGE_NAME:latest" \
    npx prisma migrate deploy; then
    log_error "Database migration failed!"
    log_warn "Attempting rollback to previous image..."
    
    # Rollback to previous image
    if sudo docker image inspect "$IMAGE_NAME:previous" > /dev/null 2>&1; then
        sudo docker tag "$IMAGE_NAME:previous" "$IMAGE_NAME:latest"
        log_info "Rolled back to previous image"
    fi
    exit 1
fi

# Run new container with environment file
log_info "Starting new container..."
if ! sudo docker run -d \
    -p "$PORT:3000" \
    --restart always \
    --env-file "$ENV_FILE" \
    --name "$APP_NAME" \
    "$IMAGE_NAME:latest"; then
    log_error "Failed to start container!"
    exit 1
fi

# Wait for container to start
log_info "Waiting for container to start..."
sleep 5

# Health check
log_info "Performing health check..."
MAX_RETRIES=10
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -sf "http://localhost:$PORT/api/health" > /dev/null 2>&1; then
        log_info "Health check passed!"
        break
    fi
    
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
        log_warn "Health check failed, retrying in 3 seconds... ($RETRY_COUNT/$MAX_RETRIES)"
        sleep 3
    fi
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    log_warn "Health check failed after $MAX_RETRIES attempts"
    log_info "Checking if container is still running..."
    
    if sudo docker ps | grep -q "$APP_NAME"; then
        log_warn "Container is running but health check failed. Check logs:"
        sudo docker logs --tail 50 "$APP_NAME"
    else
        log_error "Container failed to start. Rolling back..."
        
        # Rollback
        if sudo docker image inspect "$IMAGE_NAME:previous" > /dev/null 2>&1; then
            sudo docker run -d \
                -p "$PORT:3000" \
                --restart always \
                --env-file "$ENV_FILE" \
                --name "$APP_NAME" \
                "$IMAGE_NAME:previous"
            log_info "Rolled back to previous version"
        fi
        exit 1
    fi
fi

# Verify container is running
if sudo docker ps | grep -q "$APP_NAME"; then
    echo ""
    echo "========================================"
    log_info "Deployment successful!"
    echo "========================================"
    
    # Try to get public IP
    PUBLIC_IP=$(curl -s --max-time 2 http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo "")
    if [ -n "$PUBLIC_IP" ]; then
        log_info "Application is available at http://$PUBLIC_IP:$PORT"
    else
        log_info "Application is available at http://localhost:$PORT"
    fi
    
    # Show container status
    echo ""
    log_info "Container status:"
    sudo docker ps --filter "name=$APP_NAME" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    
    # Cleanup old images
    log_info "Cleaning up old images..."
    sudo docker image prune -f > /dev/null 2>&1 || true
else
    log_error "Container failed to start"
    sudo docker logs "$APP_NAME" 2>/dev/null || true
    exit 1
fi
