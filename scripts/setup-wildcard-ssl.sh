#!/bin/bash

# Setup Wildcard SSL Certificate with Route53 DNS Validation
# This script configures automatic wildcard certificate issuance and renewal
# using AWS Route53 for DNS validation.
#
# Prerequisites:
# 1. AWS CLI configured with credentials that have Route53 permissions
# 2. The domain must be hosted in Route53
#
# Required IAM permissions:
# {
#   "Version": "2012-10-17",
#   "Statement": [
#     {
#       "Effect": "Allow",
#       "Action": [
#         "route53:ListHostedZones",
#         "route53:GetChange"
#       ],
#       "Resource": "*"
#     },
#     {
#       "Effect": "Allow",
#       "Action": [
#         "route53:ChangeResourceRecordSets"
#       ],
#       "Resource": "arn:aws:route53:::hostedzone/YOUR_HOSTED_ZONE_ID"
#     }
#   ]
# }

set -e

DOMAIN="upliftergymnastics.com"
EMAIL="${CERTBOT_EMAIL:-admin@upliftergymnastics.com}"

# Colors
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
echo "   Wildcard SSL Setup for $DOMAIN"
echo "========================================"
echo ""

# Check if running as root or with sudo
if [[ $EUID -ne 0 ]]; then
    log_error "This script must be run as root or with sudo"
    exit 1
fi

# Check AWS credentials
log_step "Checking AWS credentials..."
if ! aws sts get-caller-identity &> /dev/null; then
    log_error "AWS credentials not configured!"
    echo ""
    echo "Please configure AWS credentials with Route53 permissions:"
    echo "  1. Create an IAM user/role with the policy shown in this script"
    echo "  2. Configure credentials: aws configure"
    echo "  3. Or set environment variables: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY"
    echo ""
    exit 1
fi
log_info "AWS credentials found"

# Check if Route53 has the domain
log_step "Checking Route53 hosted zone..."
HOSTED_ZONE=$(aws route53 list-hosted-zones --query "HostedZones[?Name=='${DOMAIN}.'].Id" --output text)
if [ -z "$HOSTED_ZONE" ]; then
    log_error "Domain $DOMAIN not found in Route53!"
    echo "Available hosted zones:"
    aws route53 list-hosted-zones --query "HostedZones[].Name" --output table
    exit 1
fi
log_info "Found hosted zone: $HOSTED_ZONE"

# Install certbot Route53 plugin if not present
log_step "Checking certbot Route53 plugin..."
if ! pip3 show certbot-dns-route53 &> /dev/null; then
    log_info "Installing certbot-dns-route53 plugin..."
    pip3 install certbot-dns-route53
else
    log_info "certbot-dns-route53 already installed"
fi

# Request wildcard certificate
log_step "Requesting wildcard certificate..."
certbot certonly \
    --dns-route53 \
    --agree-tos \
    --non-interactive \
    --email "$EMAIL" \
    -d "$DOMAIN" \
    -d "*.$DOMAIN" \
    --cert-name "$DOMAIN"

# Update nginx configuration
log_step "Updating nginx configuration..."
NGINX_CONF="/etc/nginx/conf.d/upliftergymnastics.com.conf"

if [ -f "$NGINX_CONF" ]; then
    # Backup existing config
    cp "$NGINX_CONF" "$NGINX_CONF.bak"
    
    # Check if the certificate path is correct
    if grep -q "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" "$NGINX_CONF"; then
        log_info "Nginx already configured with correct certificate path"
    else
        log_warn "Nginx may need manual configuration update"
    fi
fi

# Test nginx configuration
log_step "Testing nginx configuration..."
nginx -t

# Reload nginx
log_step "Reloading nginx..."
systemctl reload nginx

# Setup auto-renewal with Route53
log_step "Setting up automatic renewal..."
CRON_FILE="/etc/cron.d/certbot-renew"
cat > "$CRON_FILE" << 'EOF'
# Certbot auto-renewal with Route53 DNS validation
# Runs twice daily as recommended by Let's Encrypt
0 0,12 * * * root /usr/bin/certbot renew --quiet --post-hook "systemctl reload nginx"
EOF
chmod 644 "$CRON_FILE"
log_info "Automatic renewal configured"

# Verify certificate
log_step "Verifying certificate..."
echo ""
certbot certificates --cert-name "$DOMAIN"

echo ""
echo "========================================"
log_info "Wildcard SSL setup complete!"
echo "========================================"
echo ""
log_info "Certificate covers:"
echo "  - $DOMAIN"
echo "  - *.$DOMAIN (all subdomains)"
echo ""
log_info "Auto-renewal is configured and will run twice daily"
echo ""
