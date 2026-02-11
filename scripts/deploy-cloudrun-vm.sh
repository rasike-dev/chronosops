#!/bin/bash

# ChronosOps Cloud Run + VM Deployment Script
# This script automates the initial setup

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
MACHINE_TYPE="${MACHINE_TYPE:-e2-standard-2}"

echo -e "${GREEN}ChronosOps Cloud Run + VM Deployment Script${NC}"
echo "=================================================="
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
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable vpcaccess.googleapis.com

# Create VM
echo -e "${GREEN}Creating VM instance: ${VM_NAME}${NC}"
gcloud compute instances create $VM_NAME \
  --zone=$ZONE \
  --machine-type=$MACHINE_TYPE \
  --image-family=ubuntu-2204-lts \
  --image-project=ubuntu-os-cloud \
  --boot-disk-size=30GB \
  --boot-disk-type=pd-standard \
  --tags=chronosops-services \
  --metadata=startup-script='#!/bin/bash
    apt-get update
    apt-get install -y curl git
  '

# Get VM IPs
echo -e "${GREEN}Getting VM IP addresses...${NC}"
VM_INTERNAL_IP=$(gcloud compute instances describe $VM_NAME \
  --zone=$ZONE \
  --format='get(networkInterfaces[0].networkIP)')

VM_EXTERNAL_IP=$(gcloud compute instances describe $VM_NAME \
  --zone=$ZONE \
  --format='get(networkInterfaces[0].accessConfigs[0].natIP)')

echo -e "${GREEN}VM Internal IP: ${VM_INTERNAL_IP}${NC}"
echo -e "${GREEN}VM External IP: ${VM_EXTERNAL_IP}${NC}"

# Get current IP
CURRENT_IP=$(curl -s ifconfig.me)

# Configure firewall rules
echo -e "${GREEN}Configuring firewall rules...${NC}"

# SSH
gcloud compute firewall-rules create chronosops-ssh \
  --allow tcp:22 \
  --source-ranges ${CURRENT_IP}/32 \
  --target-tags chronosops-services \
  --description "Allow SSH for ChronosOps VM" 2>/dev/null || \
  echo -e "${YELLOW}Firewall rule chronosops-ssh already exists${NC}"

# PostgreSQL (internal only)
gcloud compute firewall-rules create chronosops-postgres \
  --allow tcp:5432 \
  --source-ranges 10.0.0.0/8 \
  --target-tags chronosops-services \
  --description "Allow PostgreSQL from VPC" 2>/dev/null || \
  echo -e "${YELLOW}Firewall rule chronosops-postgres already exists${NC}"

# Keycloak (internal only)
gcloud compute firewall-rules create chronosops-keycloak \
  --allow tcp:8080 \
  --source-ranges 10.0.0.0/8 \
  --target-tags chronosops-services \
  --description "Allow Keycloak from VPC" 2>/dev/null || \
  echo -e "${YELLOW}Firewall rule chronosops-keycloak already exists${NC}"

# Create VPC connector
echo -e "${GREEN}Creating VPC connector...${NC}"
gcloud compute networks vpc-access connectors create chronosops-connector \
  --region=$REGION \
  --subnet=default \
  --subnet-project=$PROJECT_ID \
  --min-instances=2 \
  --max-instances=3 \
  --machine-type=e2-micro 2>/dev/null || \
  echo -e "${YELLOW}VPC connector already exists${NC}"

echo ""
echo -e "${GREEN}Initial Setup Complete!${NC}"
echo ""
echo "Next steps:"
echo "1. SSH into VM and set up services:"
echo "   ${YELLOW}gcloud compute ssh ${VM_NAME} --zone=${ZONE}${NC}"
echo ""
echo "2. On VM, run:"
echo "   ${YELLOW}curl -fsSL https://get.docker.com -o get-docker.sh && sudo sh get-docker.sh${NC}"
echo "   ${YELLOW}sudo usermod -aG docker \$USER && exit${NC}"
echo ""
echo "3. Follow the detailed guide:"
echo "   ${YELLOW}docs/DEPLOYMENT_CLOUDRUN_VM.md${NC}"
echo ""
echo "4. Important IPs:"
echo "   VM Internal IP: ${GREEN}${VM_INTERNAL_IP}${NC}"
echo "   VM External IP: ${GREEN}${VM_EXTERNAL_IP}${NC}"
echo "   Save these for Cloud Run configuration!"
echo ""
