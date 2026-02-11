#!/bin/bash

# Fix SSH Access to GCP VM
# This script generates an SSH key and adds it to the VM

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PROJECT_ID="${PROJECT_ID:-chronosops}"
ZONE="${ZONE:-us-central1-a}"
VM_NAME="${VM_NAME:-chronosops-vm}"

echo -e "${GREEN}Fix SSH Access to GCP VM${NC}"
echo "================================"
echo ""

# Check if SSH key exists
if [ -f ~/.ssh/id_rsa.pub ]; then
    echo -e "${GREEN}Found existing SSH key: ~/.ssh/id_rsa.pub${NC}"
    SSH_KEY_FILE=~/.ssh/id_rsa.pub
elif [ -f ~/.ssh/id_ed25519.pub ]; then
    echo -e "${GREEN}Found existing SSH key: ~/.ssh/id_ed25519.pub${NC}"
    SSH_KEY_FILE=~/.ssh/id_ed25519.pub
else
    echo -e "${YELLOW}No SSH key found. Generating new key...${NC}"
    ssh-keygen -t rsa -b 4096 -f ~/.ssh/id_rsa -C "$(whoami)@chronosops" -N ""
    SSH_KEY_FILE=~/.ssh/id_rsa.pub
    echo -e "${GREEN}SSH key generated: $SSH_KEY_FILE${NC}"
fi

# Get username
USERNAME=$(whoami)

# Read public key
PUBLIC_KEY=$(cat $SSH_KEY_FILE)

echo ""
echo -e "${GREEN}Adding SSH key to VM...${NC}"
echo "VM: $VM_NAME"
echo "Zone: $ZONE"
echo "Project: $PROJECT_ID"
echo ""

# Add SSH key to VM
gcloud compute instances add-metadata $VM_NAME \
  --zone=$ZONE \
  --project=$PROJECT_ID \
  --metadata-from-file ssh-keys=<(echo "$USERNAME:$PUBLIC_KEY")

echo ""
echo -e "${GREEN}SSH key added successfully!${NC}"
echo ""
echo "Try SSH again:"
echo -e "${YELLOW}gcloud compute ssh $VM_NAME --zone=$ZONE --project=$PROJECT_ID${NC}"
echo ""
echo "Or with IAP tunneling:"
echo -e "${YELLOW}gcloud compute ssh $VM_NAME --zone=$ZONE --project=$PROJECT_ID --tunnel-through-iap${NC}"
