#!/bin/bash

# ChronosOps GCP Deployment Script
# This script automates the initial setup of ChronosOps on a Google Cloud VM

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ID="${PROJECT_ID:-chronosops-production}"
REGION="${REGION:-us-central1}"
ZONE="${ZONE:-us-central1-a}"
VM_NAME="${VM_NAME:-chronosops-vm}"
MACHINE_TYPE="${MACHINE_TYPE:-e2-standard-4}"

echo -e "${GREEN}ChronosOps GCP Deployment Script${NC}"
echo "=================================="
echo ""

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}Error: gcloud CLI is not installed.${NC}"
    echo "Install it from: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Check if user is authenticated
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    echo -e "${YELLOW}Warning: Not authenticated with gcloud.${NC}"
    echo "Running: gcloud auth login"
    gcloud auth login
fi

# Set project
echo -e "${GREEN}Setting project to: ${PROJECT_ID}${NC}"
gcloud config set project $PROJECT_ID

# Enable required APIs
echo -e "${GREEN}Enabling required APIs...${NC}"
gcloud services enable compute.googleapis.com

# Create VM
echo -e "${GREEN}Creating VM instance: ${VM_NAME}${NC}"
gcloud compute instances create $VM_NAME \
  --zone=$ZONE \
  --machine-type=$MACHINE_TYPE \
  --image-family=ubuntu-2204-lts \
  --image-project=ubuntu-os-cloud \
  --boot-disk-size=50GB \
  --boot-disk-type=pd-standard \
  --tags=chronosops-server \
  --metadata=startup-script='#!/bin/bash
    apt-get update
    apt-get install -y curl git
  '

# Get VM IP
echo -e "${GREEN}Getting VM IP address...${NC}"
VM_IP=$(gcloud compute instances describe $VM_NAME \
  --zone=$ZONE \
  --format='get(networkInterfaces[0].accessConfigs[0].natIP)')

echo -e "${GREEN}VM IP: ${VM_IP}${NC}"

# Configure firewall rules
echo -e "${GREEN}Configuring firewall rules...${NC}"

# HTTP
gcloud compute firewall-rules create chronosops-http \
  --allow tcp:3000,tcp:4000 \
  --source-ranges 0.0.0.0/0 \
  --target-tags chronosops-server \
  --description "Allow HTTP for ChronosOps" 2>/dev/null || \
  echo -e "${YELLOW}Firewall rule chronosops-http already exists${NC}"

# SSH (restrict to current IP)
CURRENT_IP=$(curl -s ifconfig.me)
echo -e "${GREEN}Restricting SSH to your IP: ${CURRENT_IP}${NC}"
gcloud compute firewall-rules create chronosops-ssh \
  --allow tcp:22 \
  --source-ranges ${CURRENT_IP}/32 \
  --target-tags chronosops-server \
  --description "Allow SSH for ChronosOps" 2>/dev/null || \
  echo -e "${YELLOW}Firewall rule chronosops-ssh already exists${NC}"

echo ""
echo -e "${GREEN}VM Setup Complete!${NC}"
echo ""
echo "Next steps:"
echo "1. SSH into the VM:"
echo "   ${YELLOW}gcloud compute ssh ${VM_NAME} --zone=${ZONE}${NC}"
echo ""
echo "2. Follow the deployment guide:"
echo "   ${YELLOW}docs/DEPLOYMENT_GCP_VM.md${NC}"
echo ""
echo "3. VM IP Address: ${GREEN}${VM_IP}${NC}"
echo ""
echo "4. Access URLs (after setup):"
echo "   Web Console: ${GREEN}http://${VM_IP}:3000${NC}"
echo "   API: ${GREEN}http://${VM_IP}:4000/v1/health${NC}"
echo ""
