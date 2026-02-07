# ChronosOps Environment Variables Reference

This document lists all environment variables required or optional for the ChronosOps application.

## Environment File Location

The application looks for `.env` files in this order:
1. **Root level**: `/chronosops/.env` (preferred for monorepo)
2. **API level**: `/chronosops/apps/api/.env` (fallback)

---

## Required Environment Variables

### Database

#### `DATABASE_URL`
- **Type**: Required
- **Description**: PostgreSQL database connection string
- **Format**: `postgresql://user:password@host:port/database`
- **Example**: `postgresql://postgres:password@localhost:5432/chronosops`
- **Used by**: Prisma ORM for all database operations
- **Where**: `apps/api/src/prisma/prisma.service.ts`, `apps/api/src/main.ts`

---

### Authentication (OIDC/JWT)

#### `OIDC_ISSUER_URL`
- **Type**: Required (if `AUTH_REQUIRED=true`)
- **Description**: OIDC provider issuer URL
- **Example**: `https://accounts.google.com` or `https://your-auth-provider.com`
- **Used by**: JWT token validation
- **Where**: `apps/api/src/config/auth.config.ts`

#### `OIDC_AUDIENCE`
- **Type**: Required (if `AUTH_REQUIRED=true`)
- **Description**: OIDC audience (client ID)
- **Example**: `your-client-id` or `chronosops-api`
- **Used by**: JWT token validation
- **Where**: `apps/api/src/config/auth.config.ts`

#### `OIDC_JWKS_URI`
- **Type**: Required (if `AUTH_REQUIRED=true`)
- **Description**: JSON Web Key Set URI for token verification
- **Example**: `https://your-auth-provider.com/.well-known/jwks.json`
- **Used by**: JWT token signature verification
- **Where**: `apps/api/src/config/auth.config.ts`

#### `AUTH_REQUIRED`
- **Type**: Optional (default: `true`)
- **Description**: Whether authentication is required
- **Values**: `true` | `false`
- **Default**: `true`
- **Note**: Set to `false` to disable authentication (development only)
- **Where**: `apps/api/src/config/auth.config.ts`

---

## Optional Environment Variables

### Server Configuration

#### `PORT`
- **Type**: Optional
- **Description**: Port number for the API server
- **Default**: `4000`
- **Example**: `4000` or `3000`
- **Where**: `apps/api/src/main.ts`

---

### Google Cloud Platform (GCP) Integration

These variables are needed for GCP-based evidence collection (metrics, logs, traces, deploys).

#### `GCP_PROJECT_ID`
- **Type**: Optional (required for GCP collectors)
- **Description**: Google Cloud Project ID
- **Example**: `my-project-123456`
- **Used by**: 
  - GCP Metrics Collector
  - GCP Logs Collector
  - GCP Traces Collector
  - Deploys Collector (if using GCP)
- **Where**: 
  - `apps/api/src/collectors/gcp-metrics/gcp-metrics.client.ts`
  - `apps/api/src/collectors/logs/logs.client.ts`
  - `apps/api/src/collectors/traces/traces.client.ts`
  - `apps/api/src/collectors/deploys/deploys.client.ts`

#### `GOOGLE_APPLICATION_CREDENTIALS`
- **Type**: Optional (required for GCP collectors)
- **Description**: Path to Google Cloud service account JSON key file
- **Example**: `/path/to/service-account-key.json` or `/Users/me/gcp-key.json`
- **Used by**: All GCP collectors for authentication
- **Where**: Same as `GCP_PROJECT_ID`
- **Note**: Can also use Application Default Credentials (ADC) if running on GCP

---

### Collector Mode Configuration

These variables control which collectors are active and their behavior.

#### `CHRONOSOPS_GCP_METRICS_MODE`
- **Type**: Optional
- **Description**: Mode for GCP Metrics Collector
- **Values**: `"gcp"` | `"real"` | `"stub"` | `"REAL"` | `"STUB"`
- **Default**: Auto-detects based on GCP credentials
- **Where**: `apps/api/src/collectors/gcp-metrics/gcp-metrics.client.ts`
- **Behavior**:
  - `"gcp"` or `"REAL"`: Use real GCP Monitoring API (requires GCP credentials)
  - `"stub"` or `"STUB"`: Return mock data (for testing)
  - Auto-detects: Uses real mode if `GCP_PROJECT_ID` and `GOOGLE_APPLICATION_CREDENTIALS` are set

#### `CHRONOSOPS_DEPLOYS_MODE`
- **Type**: Optional
- **Description**: Mode for Deploys Collector
- **Values**: `"github"` | `"gcp"` | `"real"` | `"stub"` | `"REAL"` | `"STUB"`
- **Default**: Auto-detects based on available credentials
- **Where**: `apps/api/src/collectors/deploys/deploys.client.ts`
- **Behavior**:
  - `"github"`: Use GitHub API (requires `GITHUB_TOKEN` and `GITHUB_REPO`)
  - `"gcp"` or `"real"` or `"REAL"`: Use GCP Cloud Build API (requires GCP credentials)
  - `"stub"` or `"STUB"`: Return mock data
  - Auto-detects: Uses real mode if GitHub or GCP credentials are available

#### `CHRONOSOPS_CONFIG_DIFF_MODE`
- **Type**: Optional
- **Description**: Mode for Config Diff Collector
- **Values**: `"stub"` | `"real"` | `"REAL"` | `"STUB"`
- **Default**: `"stub"` (real mode not yet implemented)
- **Where**: `apps/api/src/collectors/configdiff/configdiff.client.ts`
- **Behavior**:
  - `"stub"` or `"STUB"`: Return mock data (current default)
  - `"real"` or `"REAL"`: Would use real config tracking (not yet implemented)
- **Note**: Real config diff collection not yet implemented, always uses stub mode

#### `CHRONOSOPS_LOGS_MODE`
- **Type**: Optional
- **Description**: Mode for Logs Collector
- **Values**: `"gcp"` | `"stub"` | `"real"`
- **Default**: `"stub"` (if GCP credentials not available)
- **Where**: `apps/api/src/collectors/logs/logs.client.ts`
- **Behavior**:
  - `"gcp"` or `"real"`: Use GCP Cloud Logging API (requires GCP credentials)
  - `"stub"`: Return mock data
  - Auto-detects based on `GCP_PROJECT_ID` and `GOOGLE_APPLICATION_CREDENTIALS`

#### `CHRONOSOPS_TRACES_MODE`
- **Type**: Optional
- **Description**: Mode for Traces Collector
- **Values**: `"gcp"` | `"stub"` | `"real"`
- **Default**: `"stub"` (if GCP credentials not available)
- **Where**: `apps/api/src/collectors/traces/traces.client.ts`
- **Behavior**:
  - `"gcp"` or `"real"`: Use GCP Cloud Trace API (requires GCP credentials)
  - `"stub"`: Return mock data
  - Auto-detects based on `GCP_PROJECT_ID` and `GOOGLE_APPLICATION_CREDENTIALS`

---

### GitHub Integration (for Deploys Collector)

#### `GITHUB_TOKEN`
- **Type**: Optional (required if `CHRONOSOPS_DEPLOYS_MODE=github`)
- **Description**: GitHub Personal Access Token or OAuth token
- **Example**: `ghp_xxxxxxxxxxxxxxxxxxxx`
- **Used by**: Deploys Collector to fetch deployment history
- **Where**: `apps/api/src/collectors/deploys/deploys.client.ts`
- **Permissions needed**: `repo` scope (for private repos) or `public_repo` (for public repos)

#### `GITHUB_REPO`
- **Type**: Optional (required if `CHRONOSOPS_DEPLOYS_MODE=github`)
- **Description**: GitHub repository in format `owner/repo`
- **Example**: `myorg/myservice` or `google/cloud-build`
- **Used by**: Deploys Collector
- **Where**: `apps/api/src/collectors/deploys/deploys.client.ts`

---

### AI/ML Integration

#### `GEMINI_API_KEY`
- **Type**: Optional (required for AI reasoning)
- **Description**: Google Gemini API key for AI-powered incident analysis
- **Example**: `AIzaSy...` (Google AI Studio API key)
- **Used by**: `GeminiReasoningAdapter` for generating incident analysis
- **Where**: `apps/api/src/reasoning/reasoning.adapter.ts`
- **Note**: Currently placeholder - needs implementation
- **How to get**: 
  1. Go to https://aistudio.google.com/app/apikey
  2. Create API key
  3. Copy and set in `.env`

---

## Environment Variable Summary by Feature

### Minimum Setup (Basic Functionality)
```bash
# Required
DATABASE_URL=postgresql://user:password@localhost:5432/chronosops

# Authentication (if enabled)
OIDC_ISSUER_URL=https://your-auth-provider.com
OIDC_AUDIENCE=your-client-id
OIDC_JWKS_URI=https://your-auth-provider.com/.well-known/jwks.json
AUTH_REQUIRED=true

# Optional
PORT=4000
```

### With GCP Evidence Collection
```bash
# All minimum setup variables +
GCP_PROJECT_ID=my-project-123456
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json
CHRONOSOPS_GCP_METRICS_MODE=gcp
CHRONOSOPS_DEPLOYS_MODE=gcp
CHRONOSOPS_TRACES_MODE=gcp
```

### With GitHub Deployments
```bash
# All minimum setup variables +
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
GITHUB_REPO=myorg/myservice
CHRONOSOPS_DEPLOYS_MODE=github
```

### With AI Reasoning
```bash
# All minimum setup variables +
GEMINI_API_KEY=AIzaSy...
```

### Development/Testing Setup (Mock Mode)
```bash
# Required
DATABASE_URL=postgresql://user:password@localhost:5432/chronosops

# Disable auth for development
AUTH_REQUIRED=false

# Use mock collectors
CHRONOSOPS_GCP_METRICS_MODE=stub
CHRONOSOPS_LOGS_MODE=stub
CHRONOSOPS_DEPLOYS_MODE=stub
CHRONOSOPS_TRACES_MODE=stub
CHRONOSOPS_CONFIG_DIFF_MODE=stub

# Optional
PORT=4000
```

---

## Example `.env` File

Create a `.env` file in the root directory (`/chronosops/.env`):

```bash
# ============================================================================
# Database
# ============================================================================
DATABASE_URL=postgresql://postgres:password@localhost:5432/chronosops

# ============================================================================
# Server
# ============================================================================
PORT=4000

# ============================================================================
# Authentication (OIDC/JWT)
# ============================================================================
AUTH_REQUIRED=true
OIDC_ISSUER_URL=https://accounts.google.com
OIDC_AUDIENCE=your-client-id-here
OIDC_JWKS_URI=https://www.googleapis.com/oauth2/v3/certs

# ============================================================================
# Google Cloud Platform (for evidence collection)
# ============================================================================
GCP_PROJECT_ID=my-project-123456
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json

# Collector modes
CHRONOSOPS_GCP_METRICS_MODE=gcp
CHRONOSOPS_LOGS_MODE=gcp
CHRONOSOPS_DEPLOYS_MODE=gcp
CHRONOSOPS_TRACES_MODE=gcp
CHRONOSOPS_CONFIG_DIFF_MODE=mock

# ============================================================================
# GitHub Integration (for deployments)
# ============================================================================
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
GITHUB_REPO=myorg/myservice

# ============================================================================
# AI/ML (Gemini API)
# ============================================================================
GEMINI_API_KEY=AIzaSy...
```

---

## Environment Variable Validation

The application will:
- **Fail fast** on missing required variables (for auth config)
- **Log warnings** for missing optional variables (for collectors)
- **Use defaults** where specified (PORT=4000, AUTH_REQUIRED=true)
- **Fall back to mock mode** if collectors can't authenticate

---

## Troubleshooting

### Database Connection Issues
```bash
# Verify DATABASE_URL format
echo $DATABASE_URL
# Should be: postgresql://user:password@host:port/database

# Test connection
psql $DATABASE_URL -c "SELECT 1;"
```

### Authentication Issues
```bash
# Check auth config
curl http://localhost:4000/v1/health
# Should work without auth

# If AUTH_REQUIRED=false, all endpoints should work
# If AUTH_REQUIRED=true, need valid JWT token
```

### GCP Collector Issues
```bash
# Verify GCP credentials
echo $GOOGLE_APPLICATION_CREDENTIALS
# Should point to valid JSON key file

# Test GCP authentication
gcloud auth activate-service-account --key-file=$GOOGLE_APPLICATION_CREDENTIALS
```

### Collector Mode Issues
```bash
# Check collector modes
echo $CHRONOSOPS_GCP_METRICS_MODE
echo $CHRONOSOPS_DEPLOYS_MODE

# If set to "gcp" but no credentials, collectors will fail
# Use "mock" mode for testing without GCP
```

---

## Security Notes

1. **Never commit `.env` files** to version control
2. **Use strong passwords** for DATABASE_URL
3. **Rotate API keys** regularly (GEMINI_API_KEY, GITHUB_TOKEN)
4. **Restrict service account permissions** (GCP service accounts)
5. **Use environment-specific configs** (dev, staging, prod)
6. **Store secrets in secret managers** (AWS Secrets Manager, GCP Secret Manager, etc.) for production

---

## Production Recommendations

For production deployments:

1. **Use secret management services**:
   - AWS: AWS Secrets Manager
   - GCP: Secret Manager
   - Azure: Key Vault
   - Kubernetes: Secrets

2. **Environment-specific files**:
   - `.env.development`
   - `.env.staging`
   - `.env.production`

3. **CI/CD integration**:
   - Inject secrets at deployment time
   - Never store secrets in code or config files

4. **Monitoring**:
   - Alert on missing required variables
   - Log collector mode on startup
   - Track authentication failures
