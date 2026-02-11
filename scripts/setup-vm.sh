#!/bin/bash

# ChronosOps VM Setup Script
# Run this script on the VM to install all dependencies

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}ChronosOps VM Setup Script${NC}"
echo "=============================="
echo ""

# Update system
echo -e "${GREEN}Updating system packages...${NC}"
sudo apt-get update
sudo apt-get upgrade -y

# Install Node.js 20.x
echo -e "${GREEN}Installing Node.js 20.x...${NC}"
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify Node.js installation
NODE_VERSION=$(node --version)
echo -e "${GREEN}Node.js installed: ${NODE_VERSION}${NC}"

# Install pnpm
echo -e "${GREEN}Installing pnpm...${NC}"
npm install -g pnpm

# Verify pnpm
PNPM_VERSION=$(pnpm --version)
echo -e "${GREEN}pnpm installed: ${PNPM_VERSION}${NC}"

# Install Docker
echo -e "${GREEN}Installing Docker...${NC}"
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
rm get-docker.sh

# Add current user to docker group
sudo usermod -aG docker $USER

# Install Docker Compose
echo -e "${GREEN}Installing Docker Compose...${NC}"
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify Docker
DOCKER_VERSION=$(docker --version)
echo -e "${GREEN}Docker installed: ${DOCKER_VERSION}${NC}"

# Install PostgreSQL client (optional - for direct database access)
echo -e "${GREEN}Installing PostgreSQL client...${NC}"
sudo apt-get install -y postgresql-client

# Install PM2
echo -e "${GREEN}Installing PM2...${NC}"
npm install -g pm2

# Install Nginx (optional)
read -p "Install Nginx for reverse proxy? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${GREEN}Installing Nginx...${NC}"
    sudo apt-get install -y nginx
    echo -e "${GREEN}Nginx installed${NC}"
fi

# Install additional tools
echo -e "${GREEN}Installing additional tools...${NC}"
sudo apt-get install -y \
    git \
    curl \
    wget \
    nano \
    htop \
    unzip

# Create log directory
echo -e "${GREEN}Creating log directory...${NC}"
sudo mkdir -p /var/log/chronosops
sudo chown $USER:$USER /var/log/chronosops

echo ""
echo -e "${GREEN}VM Setup Complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Log out and back in for docker group to take effect:"
echo "   ${YELLOW}exit${NC}"
echo "   ${YELLOW}gcloud compute ssh YOUR_VM_NAME --zone=YOUR_ZONE${NC}"
echo ""
echo "2. Clone your repository:"
echo "   ${YELLOW}git clone YOUR_REPO_URL ~/apps/chronosops${NC}"
echo ""
echo "3. Clone your repository:"
echo "   ${YELLOW}git clone YOUR_REPO_URL ~/apps/chronosops${NC}"
echo ""
echo "4. Install application dependencies:"
echo "   ${YELLOW}cd ~/apps/chronosops && pnpm install && pnpm build${NC}"
echo ""
echo "5. Configure .env file:"
echo "   ${YELLOW}cp .env.example .env && nano .env${NC}"
echo "   Set: DATABASE_URL, GEMINI_API_KEY, POSTGRES_* variables"
echo ""
echo "6. Start PostgreSQL with Docker Compose:"
echo "   ${YELLOW}docker compose up -d postgres${NC}"
echo ""
echo "7. Run database migrations:"
echo "   ${YELLOW}cd apps/api && pnpm prisma migrate deploy && pnpm prisma generate${NC}"
echo ""
echo "8. Start application:"
echo "   Option A: ${YELLOW}docker compose up -d${NC} (all services)"
echo "   Option B: Use PM2 (see deployment guide)"
echo ""
echo "See full guide: ${YELLOW}docs/DEPLOYMENT_GCP_VM.md${NC}"
echo ""
