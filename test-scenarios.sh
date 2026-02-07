#!/bin/bash

# ChronosOps API Testing Script
# Usage: ./test-scenarios.sh [BASE_URL] [AUTH_TOKEN]
# Example: ./test-scenarios.sh http://localhost:4000 "Bearer your-jwt-token"

BASE_URL="${1:-http://localhost:4000}"
AUTH_TOKEN="${2:-}"
API_BASE="${BASE_URL}/v1"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== ChronosOps API Testing Script ===${NC}\n"

# Function to make API calls
api_call() {
  local method=$1
  local endpoint=$2
  local data=$3
  local description=$4
  
  echo -e "${YELLOW}${description}${NC}"
  echo -e "  ${BLUE}${method} ${endpoint}${NC}"
  
  if [ -n "$data" ]; then
    if [ "$method" = "GET" ]; then
      response=$(curl -s -w "\n%{http_code}" -X GET \
        -H "Content-Type: application/json" \
        ${AUTH_TOKEN:+-H "Authorization: $AUTH_TOKEN"} \
        "${API_BASE}${endpoint}")
    else
      response=$(curl -s -w "\n%{http_code}" -X ${method} \
        -H "Content-Type: application/json" \
        ${AUTH_TOKEN:+-H "Authorization: $AUTH_TOKEN"} \
        -d "$data" \
        "${API_BASE}${endpoint}")
    fi
  else
    response=$(curl -s -w "\n%{http_code}" -X ${method} \
      -H "Content-Type: application/json" \
      ${AUTH_TOKEN:+-H "Authorization: $AUTH_TOKEN"} \
      "${API_BASE}${endpoint}")
  fi
  
  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | sed '$d')
  
  if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
    echo -e "  ${GREEN}✓ Success (HTTP $http_code)${NC}"
    echo "$body" | jq '.' 2>/dev/null || echo "$body"
  else
    echo -e "  ${YELLOW}✗ Failed (HTTP $http_code)${NC}"
    echo "$body"
  fi
  echo ""
}

# ============================================================================
# SCENARIO 1: Analysis Comparison Workflow (Day 15 Feature)
# ============================================================================

echo -e "${BLUE}=== SCENARIO 1: Analysis Comparison Workflow ===${NC}\n"

# Step 1: List available scenarios
api_call "GET" "/scenarios" "" "Step 1: List available scenarios"

# Step 2: Get a specific scenario (using latency-spike as example)
SCENARIO_RESPONSE=$(curl -s -X GET \
  -H "Content-Type: application/json" \
  "${API_BASE}/scenarios/latency-spike")

SCENARIO_ID=$(echo "$SCENARIO_RESPONSE" | jq -r '.scenarioId // "scenario-001"')
echo -e "${YELLOW}Using scenario: ${SCENARIO_ID}${NC}\n"

# Step 3: Analyze incident (First Analysis)
ANALYZE_DATA="{\"scenarioId\": \"${SCENARIO_ID}\", \"windowMinutesBefore\": 15, \"windowMinutesAfter\": 15}"
api_call "POST" "/incidents/analyze" "$ANALYZE_DATA" "Step 3: Analyze incident (First Analysis)"

# Extract incident ID from response (you'll need to save this manually)
echo -e "${YELLOW}⚠️  IMPORTANT: Save the 'incidentId' from the response above${NC}"
echo -e "${YELLOW}   Then update INCIDENT_ID variable in this script${NC}\n"

# For demonstration, we'll use a placeholder
INCIDENT_ID="<YOUR_INCIDENT_ID>"
echo -e "${YELLOW}Using placeholder INCIDENT_ID. Update this with actual ID from Step 3.${NC}\n"

# Step 4: Get incident details
api_call "GET" "/incidents/${INCIDENT_ID}" "" "Step 4: Get incident details"

# Step 5: Re-analyze the incident (Second Analysis)
api_call "POST" "/incidents/${INCIDENT_ID}/analyze" "" "Step 5: Re-analyze incident (Second Analysis)"

# Step 6: Compare analyses (Day 15 Feature)
# You'll need to get analysis IDs from Step 4
ANALYSIS_ID_A="<ANALYSIS_ID_1>"
ANALYSIS_ID_B="<ANALYSIS_ID_2>"
api_call "GET" "/incidents/${INCIDENT_ID}/analyses/${ANALYSIS_ID_A}/compare/${ANALYSIS_ID_B}" "" \
  "Step 6: Compare analyses (Day 15 Feature - Drift Detection)"

# ============================================================================
# SCENARIO 2: Evidence Audit Trail
# ============================================================================

echo -e "\n${BLUE}=== SCENARIO 2: Evidence Audit Trail ===${NC}\n"

# Step 1: List evidence bundles
api_call "GET" "/incidents/${INCIDENT_ID}/evidence-bundles" "" "Step 1: List evidence bundles for incident"

# Step 2: Get specific evidence bundle (update BUNDLE_ID)
BUNDLE_ID="<BUNDLE_ID>"
api_call "GET" "/incidents/evidence-bundles/${BUNDLE_ID}" "" "Step 2: Get specific evidence bundle"

# Step 3: List prompt traces
api_call "GET" "/incidents/${INCIDENT_ID}/prompt-traces" "" "Step 3: List prompt traces for incident"

# Step 4: Get full prompt trace (Admin only - update TRACE_ID)
TRACE_ID="<TRACE_ID>"
api_call "GET" "/incidents/prompt-traces/${TRACE_ID}" "" "Step 4: Get full prompt trace (Admin only)"

# ============================================================================
# SCENARIO 3: Postmortem Generation
# ============================================================================

echo -e "\n${BLUE}=== SCENARIO 3: Postmortem Generation ===${NC}\n"

# Step 1: List postmortems
api_call "GET" "/incidents/${INCIDENT_ID}/postmortems" "" "Step 1: List postmortems for incident"

# Step 2: Get postmortem markdown (update POSTMORTEM_ID)
POSTMORTEM_ID="<POSTMORTEM_ID>"
api_call "GET" "/incidents/postmortems/${POSTMORTEM_ID}/markdown" "" "Step 2: Get postmortem markdown"

# Step 3: Get postmortem JSON
api_call "GET" "/incidents/postmortems/${POSTMORTEM_ID}/json" "" "Step 3: Get postmortem JSON"

# ============================================================================
# SCENARIO 4: Google Cloud Integration
# ============================================================================

echo -e "\n${BLUE}=== SCENARIO 4: Google Cloud Integration ===${NC}\n"

# Step 1: Import Google Cloud incidents
IMPORT_DATA='{"limit": 3}'
api_call "POST" "/incidents/import/google" "$IMPORT_DATA" "Step 1: Import Google Cloud incidents"

# Step 2: List all incidents
api_call "GET" "/incidents" "" "Step 2: List all incidents (verify imported)"

# Step 3: Get imported incident details (update with actual ID)
IMPORTED_INCIDENT_ID="<IMPORTED_INCIDENT_ID>"
api_call "GET" "/incidents/${IMPORTED_INCIDENT_ID}" "" "Step 3: View imported incident details"

# ============================================================================
# Additional Endpoints
# ============================================================================

echo -e "\n${BLUE}=== Additional Endpoints ===${NC}\n"

# Health check
api_call "GET" "/health" "" "Health check"

# List scenarios
api_call "GET" "/scenarios" "" "List all scenarios"

echo -e "${GREEN}=== Testing Complete ===${NC}\n"
echo -e "${YELLOW}Note: Update placeholder IDs (INCIDENT_ID, ANALYSIS_ID, etc.) with actual values${NC}"
echo -e "${YELLOW}from the responses above to test the full workflow.${NC}\n"
