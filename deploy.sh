#!/bin/bash

# Deployment script for Uplifter application on EC2
# This script updates the application from git and rebuilds/runs the Docker container

set -e  # Exit on any error

echo "🚀 Starting deployment..."

# Navigate to project directory
cd ~/uplifter || { echo "❌ Error: ~/uplifter directory not found"; exit 1; }

# Pull latest changes from git
echo "📥 Pulling latest changes from git..."
git fetch origin
if ! git pull origin main 2>/dev/null; then
    echo "⚠️  Git pull failed, resetting to origin/main..."
    git reset --hard origin/main
fi

# Stop and remove existing container
echo "🛑 Stopping existing container..."
sudo docker stop uplifter-app 2>/dev/null || true
sudo docker rm uplifter-app 2>/dev/null || true

# Build new Docker image
echo "🔨 Building Docker image..."
sudo docker build -t uplifter .

# Run new container
echo "▶️  Starting new container..."
sudo docker run -d -p 3000:3000 --restart always --name uplifter-app uplifter

# Wait a moment for container to start
sleep 2

# Verify container is running
if sudo docker ps | grep -q uplifter-app; then
    echo "✅ Deployment successful! Container is running."
    echo "🌐 Application is available at http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)"
else
    echo "❌ Error: Container failed to start"
    sudo docker logs uplifter-app
    exit 1
fi

