#!/bin/bash

# EC2 Instance Setup Script for Uplifter Staging
# Run this script from your local machine to bootstrap the EC2 instance
# Usage: ./scripts/setup-ec2.sh

set -e

# Configuration
SSH_HOST="uplifter-staging"
DOMAIN="upliftergymnastics.com"
REPO_SSH_URL="git@github.com:akarzelkc/leapfrog.git"
REPO_HTTPS_URL="https://github.com/akarzelkc/leapfrog.git"

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
echo "   Uplifter EC2 Setup Script"
echo "   Target: $DOMAIN"
echo "========================================"
echo ""

# Check SSH connection
log_step "Checking SSH connection..."
if ! ssh -o ConnectTimeout=5 "$SSH_HOST" "echo 'connected'" > /dev/null 2>&1; then
    log_error "Cannot connect to $SSH_HOST"
    exit 1
fi
log_info "SSH connection successful"

# Copy configuration files to server
log_step "Copying configuration files..."
scp "$(dirname "$0")/nginx-staging.conf" "$SSH_HOST:/tmp/nginx-staging.conf"
scp "$(dirname "$0")/staging.env.template" "$SSH_HOST:/tmp/staging.env.template"

# Run setup on remote server
log_step "Running setup on EC2 instance..."
ssh "$SSH_HOST" << 'ENDSSH'
set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

DOMAIN="upliftergymnastics.com"

echo ""
log_info "Starting EC2 setup..."

# Update system
log_info "Updating system packages..."
sudo dnf update -y

# Install Docker
if ! command -v docker &> /dev/null; then
    log_info "Installing Docker..."
    sudo dnf install -y docker
    sudo systemctl start docker
    sudo systemctl enable docker
    sudo usermod -aG docker ec2-user
else
    log_info "Docker already installed"
fi

# Install Docker Compose plugin
if ! docker compose version &> /dev/null; then
    log_info "Installing Docker Compose..."
    sudo mkdir -p /usr/local/lib/docker/cli-plugins
    sudo curl -SL "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-$(uname -m)" -o /usr/local/lib/docker/cli-plugins/docker-compose
    sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
else
    log_info "Docker Compose already installed"
fi

# Install Nginx
if ! command -v nginx &> /dev/null; then
    log_info "Installing Nginx..."
    sudo dnf install -y nginx
    sudo systemctl start nginx
    sudo systemctl enable nginx
else
    log_info "Nginx already installed"
fi

# Install Certbot for SSL
if ! command -v certbot &> /dev/null; then
    log_info "Installing Certbot..."
    sudo dnf install -y certbot python3-certbot-nginx
else
    log_info "Certbot already installed"
fi

# Install Git
if ! command -v git &> /dev/null; then
    log_info "Installing Git..."
    sudo dnf install -y git
else
    log_info "Git already installed"
fi

# Set up SSH deploy key for GitHub
if [ ! -f ~/.ssh/github_deploy_key ]; then
    log_info "Generating SSH deploy key for GitHub..."
    ssh-keygen -t ed25519 -f ~/.ssh/github_deploy_key -N "" -C "uplifter-staging-deploy"
    
    # Configure SSH to use this key for GitHub
    cat >> ~/.ssh/config << 'EOF'

# GitHub deploy key for Uplifter
Host github.com
    HostName github.com
    User git
    IdentityFile ~/.ssh/github_deploy_key
    IdentitiesOnly yes
EOF
    chmod 600 ~/.ssh/config
    
    echo ""
    log_warn "======================================================"
    log_warn "IMPORTANT: Add this deploy key to your GitHub repository"
    log_warn "======================================================"
    echo ""
    log_info "1. Go to: https://github.com/akarzelkc/leapfrog/settings/keys"
    log_info "2. Click 'Add deploy key'"
    log_info "3. Title: uplifter-staging"
    log_info "4. Paste this key:"
    echo ""
    cat ~/.ssh/github_deploy_key.pub
    echo ""
    log_warn "======================================================"
    log_info "After adding the key, run this script again to continue setup."
    log_warn "======================================================"
    exit 0
else
    log_info "SSH deploy key already exists"
fi

# Test GitHub SSH connection
log_info "Testing GitHub SSH connection..."
if ! ssh -T git@github.com 2>&1 | grep -q "successfully authenticated"; then
    log_warn "GitHub SSH authentication not yet configured."
    log_info "Make sure you've added the deploy key to GitHub:"
    echo ""
    cat ~/.ssh/github_deploy_key.pub
    echo ""
    log_info "Add it at: https://github.com/akarzelkc/leapfrog/settings/keys"
    exit 1
fi
log_info "GitHub SSH connection successful!"

# Clone or update repository
if [ ! -d ~/uplifter ]; then
    log_info "Cloning repository from GitHub..."
    cd ~
    git clone git@github.com:akarzelkc/leapfrog.git uplifter
else
    log_info "Repository already exists, updating remote URL..."
    cd ~/uplifter
    git remote set-url origin git@github.com:akarzelkc/leapfrog.git
fi

# Set up environment file
if [ ! -f ~/.env.uplifter ]; then
    log_warn "Environment file not found. Creating from template..."
    cp /tmp/staging.env.template ~/.env.uplifter
    
    # Generate a secure password for PostgreSQL
    POSTGRES_PWD=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 32)
    sed -i "s/POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$POSTGRES_PWD/" ~/.env.uplifter
    
    # Generate NEXTAUTH_SECRET
    NEXTAUTH_SECRET=$(openssl rand -base64 32)
    sed -i "s|NEXTAUTH_SECRET=.*|NEXTAUTH_SECRET=$NEXTAUTH_SECRET|" ~/.env.uplifter
    
    log_warn "IMPORTANT: Edit ~/.env.uplifter to add your Upstash Redis credentials!"
else
    log_info "Environment file already exists"
fi

# Configure Nginx
log_info "Configuring Nginx..."
sudo cp /tmp/nginx-staging.conf /etc/nginx/conf.d/uplifter.conf
sudo rm -f /etc/nginx/conf.d/default.conf 2>/dev/null || true

# Test Nginx configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx

# Set up SSL certificate
log_info "Setting up SSL certificate..."
if [ ! -d "/etc/letsencrypt/live/$DOMAIN" ]; then
    log_warn "SSL certificate not found. Attempting to obtain one..."
    # Try to get initial cert for main domains (wildcard requires DNS validation)
    sudo certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" -d "admin.$DOMAIN" -d "login.$DOMAIN" --non-interactive --agree-tos --email admin@$DOMAIN || {
        log_warn "Certbot failed. Make sure DNS is pointing to this server."
        log_warn "You can run 'sudo certbot --nginx -d $DOMAIN' manually later."
    }
    log_warn ""
    log_warn "NOTE: For wildcard subdomain support (*.${DOMAIN}), you need DNS validation."
    log_warn "Run: sudo ./scripts/setup-wildcard-ssl.sh (requires AWS credentials)"
else
    log_info "SSL certificate already exists"
    # Check if it's a wildcard cert
    if sudo openssl x509 -in /etc/letsencrypt/live/$DOMAIN/fullchain.pem -noout -text 2>/dev/null | grep -q "\\*\\.$DOMAIN"; then
        log_info "Wildcard certificate detected - all subdomains covered"
    else
        log_warn "Certificate does not cover wildcard subdomains"
        log_warn "For wildcard support, run: sudo ./scripts/setup-wildcard-ssl.sh"
    fi
fi

# Set up certbot auto-renewal
if [ ! -f /etc/cron.d/certbot-renew ]; then
    log_info "Setting up certbot auto-renewal..."
    echo "0 0,12 * * * root /usr/bin/certbot renew --quiet --post-hook 'systemctl reload nginx'" | sudo tee /etc/cron.d/certbot-renew
    sudo chmod 644 /etc/cron.d/certbot-renew
fi

# Create Docker network if it doesn't exist
if ! sudo docker network inspect uplifter-network &> /dev/null; then
    log_info "Creating Docker network..."
    sudo docker network create uplifter-network
else
    log_info "Docker network already exists"
fi

# Start PostgreSQL container first
log_info "Starting PostgreSQL..."
cd ~/uplifter
set -a
source ~/.env.uplifter
set +a
sudo docker compose -f docker-compose.staging.yml up -d postgres

# Wait for PostgreSQL to be ready
log_info "Waiting for PostgreSQL to be ready..."
sleep 10

echo ""
echo "========================================"
log_info "Setup complete!"
echo "========================================"
echo ""
log_info "GitHub integration: ENABLED (SSH deploy key)"
log_info "Repository: git@github.com:akarzelkc/leapfrog.git"
echo ""
log_info "Next steps:"
echo "  1. Edit ~/.env.uplifter with your credentials (Upstash Redis, etc.)"
echo "  2. Ensure DNS A record for $DOMAIN points to this server"
echo "  3. Deploy from local: ./scripts/deploy-staging.sh"
echo "  4. Or deploy directly on server: cd ~/uplifter && ./deploy.sh"
echo ""
log_info "Useful commands:"
echo "  - View logs: sudo docker logs -f uplifter-app"
echo "  - Check status: sudo docker ps"
echo "  - Restart app: sudo docker compose -f docker-compose.staging.yml restart app"
echo "  - Manual git pull: cd ~/uplifter && git pull origin main"
echo ""
ENDSSH

echo ""
log_info "EC2 setup complete!"
log_info "Next: Edit environment file and run deploy-staging.sh"
echo ""
