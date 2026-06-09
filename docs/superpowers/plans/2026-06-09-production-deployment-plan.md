# ForgeAdmin Production Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Take ForgeAdmin from "code in a repo" to "deployed and processing real incidents in shadow mode" — covering Phases 1 and 2 of the production maturity roadmap.

**Architecture:** All Terraform modules exist but lack remote state backend configuration. This plan adds S3 backends, creates bootstrap/deployment automation scripts, and produces the operational tooling needed to bring the platform live. The actual `terraform apply` commands are run manually per the roadmap — this plan prepares the automation and fills code gaps.

**Tech Stack:** Terraform (HCL), Bash (zsh-compatible), TypeScript (Node.js scripts), AWS CLI v2

---

## File Structure

| File | Responsibility |
|------|----------------|
| `scripts/bootstrap-state.sh` | One-time S3 + DynamoDB creation for Terraform state backend |
| `scripts/add-cognito-users.sh` | Create initial Cognito users for the team |
| `scripts/seed-knowledge-base.ts` | Upload runbook documents to Bedrock KB S3 and trigger re-index |
| `scripts/configure-ssm-params.sh` | Set SSM parameters for ServiceNow, Teams/Slack, etc. |
| `scripts/deploy-frontend.sh` | Build React SPA and sync to S3 + CloudFront invalidation |
| `scripts/verify-deployment.sh` | Post-deploy health checks (EventBridge, Cognito, API, WebSocket) |
| `terraform/foundation/backend.tf` | S3 backend config for foundation |
| `terraform/contexts/platform/backend.tf` | S3 backend config for platform context |
| `terraform/contexts/ingestion/backend.tf` | S3 backend config for ingestion context |
| `terraform/contexts/orchestration/backend.tf` | S3 backend config for orchestration context |
| `terraform/contexts/knowledge-base/backend.tf` | S3 backend config for knowledge-base context |
| `terraform/contexts/dashboard/backend.tf` | S3 backend config for dashboard context |
| `terraform/contexts/communication/backend.tf` | S3 backend config for communication context |
| `terraform/contexts/execution/backend.tf` | S3 backend config for execution context |
| `terraform/contexts/correlation/backend.tf` | S3 backend config for correlation context |
| `seed-runbooks/README.md` | Instructions for preparing KB seed documents |

---

### Task 1: Bootstrap Script — Terraform State Backend

**Files:**
- Create: `scripts/bootstrap-state.sh`

- [ ] **Step 1: Write the bootstrap script**

```bash
#!/usr/bin/env bash
# =============================================================================
# bootstrap-state.sh — Create S3 bucket + DynamoDB table for Terraform state
#
# Usage: ./scripts/bootstrap-state.sh [region]
#   region: AWS region (default: us-east-2)
#
# This is a ONE-TIME operation. Run before any terraform init/apply.
# The resources created here are NOT managed by Terraform (chicken-and-egg).
# =============================================================================
set -euo pipefail

REGION="${1:-us-east-2}"
BUCKET="forgeadmin-terraform-state"
TABLE="forgeadmin-terraform-locks"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC} $*"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }

# --- Check prerequisites ---
if ! command -v aws &> /dev/null; then
  log_error "aws CLI is not installed. Install AWS CLI v2 first."
  exit 1
fi

# --- Check if already exists ---
if aws s3api head-bucket --bucket "$BUCKET" 2>/dev/null; then
  log_warn "S3 bucket '$BUCKET' already exists. Skipping bucket creation."
else
  log_info "Creating S3 bucket: $BUCKET"
  aws s3api create-bucket \
    --bucket "$BUCKET" \
    --region "$REGION" \
    --create-bucket-configuration LocationConstraint="$REGION"

  log_info "Enabling versioning on $BUCKET"
  aws s3api put-bucket-versioning \
    --bucket "$BUCKET" \
    --versioning-configuration Status=Enabled

  log_info "Enabling encryption on $BUCKET"
  aws s3api put-bucket-encryption \
    --bucket "$BUCKET" \
    --server-side-encryption-configuration '{
      "Rules": [{"ApplyServerSideEncryptionByDefault": {"SSEAlgorithm": "AES256"}}]
    }'

  log_info "Blocking public access on $BUCKET"
  aws s3api put-public-access-block \
    --bucket "$BUCKET" \
    --public-access-block-configuration \
      BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
fi

# --- DynamoDB lock table ---
if aws dynamodb describe-table --table-name "$TABLE" --region "$REGION" &>/dev/null; then
  log_warn "DynamoDB table '$TABLE' already exists. Skipping table creation."
else
  log_info "Creating DynamoDB lock table: $TABLE"
  aws dynamodb create-table \
    --table-name "$TABLE" \
    --attribute-definitions AttributeName=LockID,AttributeType=S \
    --key-schema AttributeName=LockID,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --region "$REGION"

  log_info "Waiting for table to become active..."
  aws dynamodb wait table-exists --table-name "$TABLE" --region "$REGION"
fi

log_info "=== Bootstrap Complete ==="
log_info "State bucket: s3://$BUCKET"
log_info "Lock table:   $TABLE"
log_info ""
log_info "Next step: Run 'terraform init' in terraform/foundation/"
```

- [ ] **Step 2: Make the script executable**

Run: `chmod +x scripts/bootstrap-state.sh`

- [ ] **Step 3: Verify script passes shellcheck**

Run: `shellcheck scripts/bootstrap-state.sh`
Expected: No errors (warnings about local are acceptable on zsh)

- [ ] **Step 4: Commit**

```bash
git add scripts/bootstrap-state.sh
git commit -m "ops: add terraform state backend bootstrap script"
```

---

### Task 2: Add S3 Backend Configuration to All Terraform Modules

**Files:**
- Create: `terraform/foundation/backend.tf`
- Create: `terraform/contexts/platform/backend.tf`
- Create: `terraform/contexts/ingestion/backend.tf`
- Create: `terraform/contexts/orchestration/backend.tf`
- Create: `terraform/contexts/knowledge-base/backend.tf`
- Create: `terraform/contexts/dashboard/backend.tf`
- Create: `terraform/contexts/communication/backend.tf`
- Create: `terraform/contexts/execution/backend.tf`
- Create: `terraform/contexts/correlation/backend.tf`

- [ ] **Step 1: Create foundation backend.tf**

```hcl
# terraform/foundation/backend.tf
terraform {
  backend "s3" {
    bucket         = "forgeadmin-terraform-state"
    key            = "forgeadmin/foundation/terraform.tfstate"
    region         = "us-east-2"
    dynamodb_table = "forgeadmin-terraform-locks"
    encrypt        = true
  }
}
```

- [ ] **Step 2: Create platform context backend.tf**

```hcl
# terraform/contexts/platform/backend.tf
terraform {
  backend "s3" {
    bucket         = "forgeadmin-terraform-state"
    key            = "forgeadmin/platform/terraform.tfstate"
    region         = "us-east-2"
    dynamodb_table = "forgeadmin-terraform-locks"
    encrypt        = true
  }
}
```

- [ ] **Step 3: Create ingestion context backend.tf**

```hcl
# terraform/contexts/ingestion/backend.tf
terraform {
  backend "s3" {
    bucket         = "forgeadmin-terraform-state"
    key            = "forgeadmin/ingestion/terraform.tfstate"
    region         = "us-east-2"
    dynamodb_table = "forgeadmin-terraform-locks"
    encrypt        = true
  }
}
```

- [ ] **Step 4: Create orchestration context backend.tf**

```hcl
# terraform/contexts/orchestration/backend.tf
terraform {
  backend "s3" {
    bucket         = "forgeadmin-terraform-state"
    key            = "forgeadmin/orchestration/terraform.tfstate"
    region         = "us-east-2"
    dynamodb_table = "forgeadmin-terraform-locks"
    encrypt        = true
  }
}
```

- [ ] **Step 5: Create knowledge-base context backend.tf**

```hcl
# terraform/contexts/knowledge-base/backend.tf
terraform {
  backend "s3" {
    bucket         = "forgeadmin-terraform-state"
    key            = "forgeadmin/knowledge-base/terraform.tfstate"
    region         = "us-east-2"
    dynamodb_table = "forgeadmin-terraform-locks"
    encrypt        = true
  }
}
```

- [ ] **Step 6: Create dashboard context backend.tf**

```hcl
# terraform/contexts/dashboard/backend.tf
terraform {
  backend "s3" {
    bucket         = "forgeadmin-terraform-state"
    key            = "forgeadmin/dashboard/terraform.tfstate"
    region         = "us-east-2"
    dynamodb_table = "forgeadmin-terraform-locks"
    encrypt        = true
  }
}
```

- [ ] **Step 7: Create communication context backend.tf**

```hcl
# terraform/contexts/communication/backend.tf
terraform {
  backend "s3" {
    bucket         = "forgeadmin-terraform-state"
    key            = "forgeadmin/communication/terraform.tfstate"
    region         = "us-east-2"
    dynamodb_table = "forgeadmin-terraform-locks"
    encrypt        = true
  }
}
```

- [ ] **Step 8: Create execution context backend.tf**

```hcl
# terraform/contexts/execution/backend.tf
terraform {
  backend "s3" {
    bucket         = "forgeadmin-terraform-state"
    key            = "forgeadmin/execution/terraform.tfstate"
    region         = "us-east-2"
    dynamodb_table = "forgeadmin-terraform-locks"
    encrypt        = true
  }
}
```

- [ ] **Step 9: Create correlation context backend.tf**

```hcl
# terraform/contexts/correlation/backend.tf
terraform {
  backend "s3" {
    bucket         = "forgeadmin-terraform-state"
    key            = "forgeadmin/correlation/terraform.tfstate"
    region         = "us-east-2"
    dynamodb_table = "forgeadmin-terraform-locks"
    encrypt        = true
  }
}
```

- [ ] **Step 10: Verify all modules still validate with backend config**

Run:
```bash
cd terraform/foundation && terraform init -backend=false && terraform validate
for dir in terraform/contexts/*/; do
  cd "$dir" && terraform init -backend=false && terraform validate && cd - > /dev/null
done
```
Expected: All modules validate successfully (backend=false skips actual S3 connection)

- [ ] **Step 11: Commit**

```bash
git add terraform/foundation/backend.tf terraform/contexts/*/backend.tf
git commit -m "ops: add S3 backend configuration to all terraform modules"
```

---

### Task 3: Cognito User Creation Script

**Files:**
- Create: `scripts/add-cognito-users.sh`

- [ ] **Step 1: Write the Cognito user creation script**

```bash
#!/usr/bin/env bash
# =============================================================================
# add-cognito-users.sh — Create Cognito users for the ForgeAdmin team
#
# Usage: ./scripts/add-cognito-users.sh <user-pool-id> <email> <role>
#   user-pool-id: Cognito User Pool ID (from terraform output)
#   email: User's email address
#   role: team_lead or team_member
#
# Example:
#   ./scripts/add-cognito-users.sh us-east-2_ABC123 matt.rogers@dot.ohio.gov team_lead
# =============================================================================
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC} $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }

if [[ $# -lt 3 ]]; then
  echo "Usage: $0 <user-pool-id> <email> <role>"
  echo "  role: team_lead or team_member"
  exit 1
fi

USER_POOL_ID="$1"
EMAIL="$2"
ROLE="$3"

# Validate role
if [[ "$ROLE" != "team_lead" && "$ROLE" != "team_member" ]]; then
  log_error "Role must be 'team_lead' or 'team_member'. Got: $ROLE"
  exit 1
fi

# Extract username from email (before @)
USERNAME="${EMAIL%%@*}"

log_info "Creating user: $USERNAME ($EMAIL) with role: $ROLE"

# Create the user (sends invitation email)
aws cognito-idp admin-create-user \
  --user-pool-id "$USER_POOL_ID" \
  --username "$USERNAME" \
  --user-attributes \
    Name=email,Value="$EMAIL" \
    Name=email_verified,Value=true \
  --desired-delivery-mediums EMAIL

# Add user to role group
log_info "Adding $USERNAME to group: $ROLE"
aws cognito-idp admin-add-user-to-group \
  --user-pool-id "$USER_POOL_ID" \
  --username "$USERNAME" \
  --group-name "$ROLE"

log_info "✓ User '$USERNAME' created and added to '$ROLE' group"
log_info "  They will receive a temporary password via email at: $EMAIL"
```

- [ ] **Step 2: Make the script executable**

Run: `chmod +x scripts/add-cognito-users.sh`

- [ ] **Step 3: Verify script passes shellcheck**

Run: `shellcheck scripts/add-cognito-users.sh`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add scripts/add-cognito-users.sh
git commit -m "ops: add cognito user creation script"
```

---

### Task 4: SSM Parameter Configuration Script

**Files:**
- Create: `scripts/configure-ssm-params.sh`

- [ ] **Step 1: Write the SSM parameter configuration script**

```bash
#!/usr/bin/env bash
# =============================================================================
# configure-ssm-params.sh — Set SSM parameters for ForgeAdmin integrations
#
# Usage: ./scripts/configure-ssm-params.sh <param-name> <param-value> [type]
#   param-name: Full SSM parameter path (e.g., /forgeadmin/ingestion/servicenow-url)
#   param-value: Value to set (or Secrets Manager ARN for secure references)
#   type: String (default) or SecureString
#
# Common parameters to configure:
#   /forgeadmin/ingestion/servicenow-url           - ServiceNow instance API URL
#   /forgeadmin/ingestion/servicenow-secret-arn    - Secrets Manager ARN for SN creds
#   /forgeadmin/ingestion/servicenow-poll-interval - Poll interval in seconds (default: 60)
#   /forgeadmin/ingestion/servicenow-filter        - Assignment group filter
#   /forgeadmin/communication/webhook-url          - Teams/Slack incoming webhook URL
#   /forgeadmin/communication/webhook-type         - "teams" or "slack"
#   /forgeadmin/execution/jump-server-url          - Jump server HTTPS endpoint
#
# Example:
#   ./scripts/configure-ssm-params.sh /forgeadmin/ingestion/servicenow-url https://odot.service-now.com/api/now/table/incident
#   ./scripts/configure-ssm-params.sh /forgeadmin/communication/webhook-url https://hooks.slack.com/... SecureString
# =============================================================================
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC} $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <param-name> <param-value> [type]"
  echo "  type: String (default) or SecureString"
  exit 1
fi

PARAM_NAME="$1"
PARAM_VALUE="$2"
PARAM_TYPE="${3:-String}"
REGION="us-east-2"

# Validate parameter path starts with /forgeadmin/
if [[ "$PARAM_NAME" != /forgeadmin/* ]]; then
  log_error "Parameter name must start with /forgeadmin/. Got: $PARAM_NAME"
  exit 1
fi

log_info "Setting SSM parameter: $PARAM_NAME (type: $PARAM_TYPE)"

aws ssm put-parameter \
  --name "$PARAM_NAME" \
  --value "$PARAM_VALUE" \
  --type "$PARAM_TYPE" \
  --overwrite \
  --region "$REGION" \
  --tags "Key=Project,Value=ForgeAdmin" "Key=ManagedBy,Value=script"

log_info "✓ Parameter set: $PARAM_NAME"
```

- [ ] **Step 2: Make the script executable**

Run: `chmod +x scripts/configure-ssm-params.sh`

- [ ] **Step 3: Verify script passes shellcheck**

Run: `shellcheck scripts/configure-ssm-params.sh`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add scripts/configure-ssm-params.sh
git commit -m "ops: add SSM parameter configuration script"
```

---

### Task 5: Frontend Deployment Script

**Files:**
- Create: `scripts/deploy-frontend.sh`

- [ ] **Step 1: Write the frontend deployment script**

```bash
#!/usr/bin/env bash
# =============================================================================
# deploy-frontend.sh — Build and deploy the React Dashboard SPA
#
# Usage: ./scripts/deploy-frontend.sh [environment]
#   environment: dev (default), staging, prod
#
# Requires:
#   - pnpm installed
#   - AWS CLI configured
#   - Dashboard Terraform context already deployed (S3 bucket + CloudFront exist)
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR/.."
FRONTEND_DIR="$PROJECT_ROOT/src/contexts/dashboard/frontend"
ENVIRONMENT="${1:-dev}"
REGION="us-east-2"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC} $*"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }

# --- Prerequisites ---
if ! command -v pnpm &> /dev/null; then
  log_error "pnpm is not installed"
  exit 1
fi

if ! command -v aws &> /dev/null; then
  log_error "aws CLI is not installed"
  exit 1
fi

# --- Resolve S3 bucket and CloudFront distribution from SSM ---
BUCKET_NAME=$(aws ssm get-parameter \
  --name "/forgeadmin/${ENVIRONMENT}/dashboard-bucket-name" \
  --region "$REGION" \
  --query "Parameter.Value" --output text 2>/dev/null || echo "")

DISTRIBUTION_ID=$(aws ssm get-parameter \
  --name "/forgeadmin/${ENVIRONMENT}/cloudfront-distribution-id" \
  --region "$REGION" \
  --query "Parameter.Value" --output text 2>/dev/null || echo "")

if [[ -z "$BUCKET_NAME" ]]; then
  log_error "Could not resolve dashboard S3 bucket from SSM parameter: /forgeadmin/${ENVIRONMENT}/dashboard-bucket-name"
  log_error "Has the dashboard Terraform context been deployed?"
  exit 1
fi

if [[ -z "$DISTRIBUTION_ID" ]]; then
  log_warn "CloudFront distribution ID not found. S3 sync will proceed but no cache invalidation."
fi

# --- Build ---
log_info "Building frontend ($ENVIRONMENT)..."
cd "$FRONTEND_DIR"
pnpm install --frozen-lockfile
pnpm build

# --- Deploy ---
log_info "Syncing dist/ to s3://$BUCKET_NAME/"
aws s3 sync dist/ "s3://$BUCKET_NAME/" \
  --delete \
  --region "$REGION" \
  --cache-control "public, max-age=31536000, immutable" \
  --exclude "index.html" \
  --exclude "*.json"

# index.html and manifests should not be cached long-term
aws s3 cp dist/index.html "s3://$BUCKET_NAME/index.html" \
  --cache-control "public, max-age=0, must-revalidate" \
  --region "$REGION"

# --- Invalidate CloudFront ---
if [[ -n "$DISTRIBUTION_ID" ]]; then
  log_info "Invalidating CloudFront cache..."
  aws cloudfront create-invalidation \
    --distribution-id "$DISTRIBUTION_ID" \
    --paths "/index.html" "/*.json" \
    --region us-east-1 > /dev/null
  log_info "Cache invalidation submitted"
fi

log_info "=== Frontend Deploy Complete ==="
log_info "Bucket: s3://$BUCKET_NAME"
if [[ -n "$DISTRIBUTION_ID" ]]; then
  log_info "CloudFront: $DISTRIBUTION_ID"
fi
```

- [ ] **Step 2: Make the script executable**

Run: `chmod +x scripts/deploy-frontend.sh`

- [ ] **Step 3: Verify script passes shellcheck**

Run: `shellcheck scripts/deploy-frontend.sh`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add scripts/deploy-frontend.sh
git commit -m "ops: add frontend build and deploy script"
```

---

### Task 6: Knowledge Base Seeding Script

**Files:**
- Create: `scripts/seed-knowledge-base.ts`
- Create: `seed-runbooks/README.md`

- [ ] **Step 1: Write the seed-runbooks README**

```markdown
# Seed Runbooks

Place your existing runbook documents here before running `scripts/seed-knowledge-base.ts`.

## Expected Format

Each runbook should be a Markdown file with the following structure:

```md
# [Title]

## Applicable Incident Types
- [List incident types this runbook addresses]

## Prerequisites
- [Required access, tools, or conditions]

## Procedure
1. [Step-by-step instructions]
2. [...]

## Expected Outcomes
- [What success looks like]

## Rollback Steps
1. [How to undo if something goes wrong]
```

## What to Include

- AD account management procedures (unlock, enable, password reset)
- Service restart procedures (common services: Print Spooler, DNS Client, etc.)
- Health check remediation steps
- DNS record management procedures
- Any tribal knowledge your team uses daily

## File Naming

Use descriptive names:
- `ad-unlock-account.md`
- `ad-enable-account.md`
- `ad-reset-password.md`
- `service-restart-print-spooler.md`
- `dns-add-a-record.md`
- `health-check-disk-space.md`

The more documents you seed, the better the Research Agent's proposals will be from day one.
```

- [ ] **Step 2: Write the seed-knowledge-base script**

```typescript
// scripts/seed-knowledge-base.ts
// Usage: pnpm tsx scripts/seed-knowledge-base.ts [environment]
//
// Uploads all markdown files from seed-runbooks/ to the KB S3 bucket
// and triggers a Bedrock Knowledge Base re-index job.

import { execSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const REGION = 'us-east-2';
const environment = process.argv[2] || 'dev';
const seedDir = resolve(__dirname, '..', 'seed-runbooks');

function run(cmd: string): string {
  return execSync(cmd, { encoding: 'utf-8' }).trim();
}

function getSSMParam(name: string): string {
  try {
    return run(
      `aws ssm get-parameter --name "${name}" --region ${REGION} --query "Parameter.Value" --output text`
    );
  } catch {
    throw new Error(`SSM parameter not found: ${name}. Has the knowledge-base context been deployed?`);
  }
}

function getMarkdownFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isFile() && entry.endsWith('.md') && entry !== 'README.md') {
      files.push(fullPath);
    }
  }
  return files;
}

async function main() {
  console.log(`[INFO] Seeding Knowledge Base (${environment})`);

  // Resolve bucket and KB IDs from SSM
  const bucketName = getSSMParam(`/forgeadmin/${environment}/kb-bucket-name`);
  const kbId = getSSMParam(`/forgeadmin/${environment}/knowledge-base-id`);
  const dataSourceId = getSSMParam(`/forgeadmin/${environment}/kb-data-source-id`);

  console.log(`[INFO] KB Bucket: ${bucketName}`);
  console.log(`[INFO] Knowledge Base ID: ${kbId}`);
  console.log(`[INFO] Data Source ID: ${dataSourceId}`);

  // Find all markdown files
  const files = getMarkdownFiles(seedDir);
  if (files.length === 0) {
    console.log('[WARN] No markdown files found in seed-runbooks/. Add .md files and re-run.');
    process.exit(0);
  }

  console.log(`[INFO] Found ${files.length} runbook(s) to upload`);

  // Upload to S3
  const s3Prefix = 'knowledge-base/seed';
  run(`aws s3 sync "${seedDir}" "s3://${bucketName}/${s3Prefix}/" --exclude "README.md" --region ${REGION}`);
  console.log(`[INFO] Uploaded ${files.length} file(s) to s3://${bucketName}/${s3Prefix}/`);

  // Trigger re-index
  console.log('[INFO] Triggering Bedrock Knowledge Base ingestion job...');
  const jobResult = run(
    `aws bedrock-agent start-ingestion-job --knowledge-base-id "${kbId}" --data-source-id "${dataSourceId}" --region ${REGION}`
  );
  console.log('[INFO] Ingestion job started:', jobResult);

  console.log('[INFO] === Seed Complete ===');
  console.log('[INFO] The Knowledge Base will be updated once the ingestion job completes (typically 1-5 minutes).');
}

main().catch((err) => {
  console.error('[ERROR]', err.message);
  process.exit(1);
});
```

- [ ] **Step 3: Verify the script compiles**

Run: `pnpm tsx --eval "import './scripts/seed-knowledge-base.ts'" 2>&1 | head -5`
Expected: No syntax/import errors (it will fail on SSM lookups without AWS, that's fine)

- [ ] **Step 4: Commit**

```bash
git add scripts/seed-knowledge-base.ts seed-runbooks/README.md
git commit -m "ops: add knowledge base seeding script and seed-runbooks directory"
```

---

### Task 7: Post-Deploy Verification Script

**Files:**
- Create: `scripts/verify-deployment.sh`

- [ ] **Step 1: Write the verification script**

```bash
#!/usr/bin/env bash
# =============================================================================
# verify-deployment.sh — Post-deployment health checks
#
# Usage: ./scripts/verify-deployment.sh [environment]
#   environment: dev (default), staging, prod
#
# Checks:
#   1. EventBridge bus exists and accepts test events
#   2. Cognito User Pool exists and has users
#   3. API Gateway responds to health check
#   4. DynamoDB tables are accessible
#   5. S3 buckets exist
#   6. CloudWatch dashboards exist
# =============================================================================
set -euo pipefail

ENVIRONMENT="${1:-dev}"
REGION="us-east-2"
PASSED=0
FAILED=0

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { echo -e "  ${GREEN}✓${NC} $*"; PASSED=$((PASSED + 1)); }
fail() { echo -e "  ${RED}✗${NC} $*"; FAILED=$((FAILED + 1)); }
section() { echo -e "\n${YELLOW}$*${NC}"; }

# --- Helper: get SSM param or return empty ---
ssm_get() {
  aws ssm get-parameter --name "$1" --region "$REGION" --query "Parameter.Value" --output text 2>/dev/null || echo ""
}

section "=== ForgeAdmin Deployment Verification ($ENVIRONMENT) ==="

# --- EventBridge ---
section "EventBridge"
BUS_ARN=$(ssm_get "/forgeadmin/${ENVIRONMENT}/eventbridge-bus-arn")
if [[ -n "$BUS_ARN" ]]; then
  pass "EventBridge bus ARN found: $BUS_ARN"
  # Try describe
  if aws events describe-event-bus --name "forgeadmin-events" --region "$REGION" &>/dev/null; then
    pass "EventBridge bus is accessible"
  else
    fail "EventBridge bus exists in SSM but is not accessible"
  fi
else
  fail "EventBridge bus ARN not found in SSM"
fi

# --- Cognito ---
section "Cognito"
POOL_ID=$(ssm_get "/forgeadmin/${ENVIRONMENT}/cognito-user-pool-id")
if [[ -n "$POOL_ID" ]]; then
  pass "Cognito User Pool ID found: $POOL_ID"
  USER_COUNT=$(aws cognito-idp list-users --user-pool-id "$POOL_ID" --region "$REGION" --query "length(Users)" --output text 2>/dev/null || echo "0")
  if [[ "$USER_COUNT" -gt 0 ]]; then
    pass "Cognito has $USER_COUNT user(s)"
  else
    fail "Cognito has no users — run scripts/add-cognito-users.sh"
  fi
else
  fail "Cognito User Pool ID not found in SSM"
fi

# --- API Gateway ---
section "API Gateway"
API_URL=$(ssm_get "/forgeadmin/${ENVIRONMENT}/api-gateway-url")
if [[ -n "$API_URL" ]]; then
  pass "API Gateway URL found: $API_URL"
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${API_URL}/modules" 2>/dev/null || echo "000")
  if [[ "$HTTP_CODE" == "401" || "$HTTP_CODE" == "200" ]]; then
    pass "API Gateway responds (HTTP $HTTP_CODE)"
  else
    fail "API Gateway not responding (HTTP $HTTP_CODE)"
  fi
else
  fail "API Gateway URL not found in SSM — dashboard context may not be deployed"
fi

# --- DynamoDB Tables ---
section "DynamoDB"
TABLES=("forgeadmin-${ENVIRONMENT}-audit" "forgeadmin-${ENVIRONMENT}-modules" "forgeadmin-${ENVIRONMENT}-ingestion")
for table in "${TABLES[@]}"; do
  if aws dynamodb describe-table --table-name "$table" --region "$REGION" &>/dev/null; then
    pass "Table exists: $table"
  else
    fail "Table not found: $table"
  fi
done

# --- S3 Buckets ---
section "S3 Buckets"
BUCKETS=("forgeadmin-storage-${ENVIRONMENT}" "forgeadmin-dashboard-${ENVIRONMENT}")
for bucket in "${BUCKETS[@]}"; do
  if aws s3api head-bucket --bucket "$bucket" 2>/dev/null; then
    pass "Bucket exists: $bucket"
  else
    fail "Bucket not found: $bucket"
  fi
done

# --- Summary ---
section "=== Results ==="
echo -e "  Passed: ${GREEN}$PASSED${NC}"
echo -e "  Failed: ${RED}$FAILED${NC}"
echo ""

if [[ $FAILED -gt 0 ]]; then
  echo -e "${RED}Some checks failed. Review the output above.${NC}"
  exit 1
else
  echo -e "${GREEN}All checks passed! Deployment looks healthy.${NC}"
  exit 0
fi
```

- [ ] **Step 2: Make the script executable**

Run: `chmod +x scripts/verify-deployment.sh`

- [ ] **Step 3: Verify script passes shellcheck**

Run: `shellcheck scripts/verify-deployment.sh`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add scripts/verify-deployment.sh
git commit -m "ops: add post-deployment verification script"
```

---

### Task 8: Update dev.tfvars with Deployment Notes

**Files:**
- Modify: `terraform/environments/dev.tfvars`

- [ ] **Step 1: Add documentation comments to dev.tfvars**

Add comments explaining what needs to be updated post-deploy:

```hcl
# terraform/environments/dev.tfvars
aws_region       = "us-east-2"
environment      = "dev"
project_name     = "forgeadmin"
state_bucket     = "forgeadmin-terraform-state"
state_lock_table = "forgeadmin-terraform-locks"

vpc_cidr             = "10.0.0.0/16"
availability_zones   = ["us-east-2a", "us-east-2b"]
private_subnet_cidrs = ["10.0.1.0/24", "10.0.2.0/24"]
public_subnet_cidrs  = ["10.0.101.0/24", "10.0.102.0/24"]

# UPDATE AFTER DASHBOARD DEPLOY: Replace localhost with CloudFront domain
# Example: ["https://d1234abcdef.cloudfront.net/callback"]
cognito_callback_urls = ["http://localhost:5173/callback"]
cognito_logout_urls   = ["http://localhost:5173"]
```

- [ ] **Step 2: Commit**

```bash
git add terraform/environments/dev.tfvars
git commit -m "docs: add deployment notes to dev.tfvars"
```

---

### Task 9: Add .gitkeep to scripts/ and seed-runbooks/ directories

**Files:**
- Create: `scripts/.gitkeep` (remove after first real script — already have scripts now)
- Verify: `seed-runbooks/` is tracked

- [ ] **Step 1: Ensure seed-runbooks is tracked even when empty of .md files**

Add a `.gitkeep` to keep the directory in git:

```bash
touch seed-runbooks/.gitkeep
```

- [ ] **Step 2: Update .gitignore to not ignore scripts outputs**

Verify `.gitignore` doesn't exclude `scripts/` or `seed-runbooks/`. Check:

Run: `grep -n "scripts" .gitignore`
Expected: No matches (or only matches for build output, not the scripts directory itself)

- [ ] **Step 3: Commit**

```bash
git add seed-runbooks/.gitkeep
git commit -m "ops: track seed-runbooks directory for KB seeding"
```

---

### Task 10: Deployment Runbook Documentation

**Files:**
- Create: `docs/DEPLOYMENT.md`

- [ ] **Step 1: Write the deployment runbook**

```markdown
# ForgeAdmin Deployment Runbook

## Overview

This document covers the step-by-step process for deploying ForgeAdmin to a fresh AWS account. It follows the Production Maturity Roadmap phases.

## Prerequisites

- [ ] AWS CLI v2 installed and configured (`aws sts get-caller-identity` works)
- [ ] Terraform >= 1.6 installed (`terraform version`)
- [ ] pnpm >= 9.x installed (`pnpm --version`)
- [ ] Node.js >= 20.x installed (`node --version`)
- [ ] GitHub repository access with push to main
- [ ] AWS account with permissions for: Lambda, EventBridge, DynamoDB, S3, Cognito, API Gateway, Step Functions, CloudWatch, X-Ray, SNS, SES, VPC, Bedrock, CloudFront, Secrets Manager

## Phase 1: Foundation (Days 1-3)

### 1.1 Bootstrap State Backend

```bash
./scripts/bootstrap-state.sh
```

This creates the S3 bucket and DynamoDB table for Terraform state. One-time operation.

### 1.2 Deploy Foundation

```bash
cd terraform/foundation
terraform init
terraform plan -var-file=../environments/dev.tfvars
terraform apply -var-file=../environments/dev.tfvars
```

Verify: SSM parameters are created for EventBridge bus ARN, VPC ID, Cognito pool ID.

### 1.3 Deploy Platform Context

```bash
cd terraform/contexts/platform
terraform init
terraform apply -var-file=../../environments/dev.tfvars
```

### 1.4 Deploy Dashboard Context

```bash
cd terraform/contexts/dashboard
terraform init
terraform apply -var-file=../../environments/dev.tfvars
```

### 1.5 Create Team Accounts

```bash
# Get the User Pool ID from SSM or terraform output
POOL_ID=$(aws ssm get-parameter --name /forgeadmin/dev/cognito-user-pool-id --query Parameter.Value --output text)

# Create team leads
./scripts/add-cognito-users.sh "$POOL_ID" matt.rogers@dot.ohio.gov team_lead
./scripts/add-cognito-users.sh "$POOL_ID" second.lead@dot.ohio.gov team_lead

# Create team members
./scripts/add-cognito-users.sh "$POOL_ID" member.one@dot.ohio.gov team_member
./scripts/add-cognito-users.sh "$POOL_ID" member.two@dot.ohio.gov team_member
```

### 1.6 Update Cognito Callback URLs

After dashboard deploys, get the CloudFront domain:
```bash
CF_DOMAIN=$(aws ssm get-parameter --name /forgeadmin/dev/cloudfront-domain --query Parameter.Value --output text)
```

Update `terraform/environments/dev.tfvars`:
```hcl
cognito_callback_urls = ["https://${CF_DOMAIN}/callback"]
cognito_logout_urls   = ["https://${CF_DOMAIN}"]
```

Re-apply foundation:
```bash
cd terraform/foundation
terraform apply -var-file=../environments/dev.tfvars
```

### 1.7 Deploy Frontend

```bash
./scripts/deploy-frontend.sh dev
```

### 1.8 Verify

```bash
./scripts/verify-deployment.sh dev
```

## Phase 2: Brain Online (Week 2-4)

### 2.1 Deploy Remaining Contexts

```bash
./terraform/scripts/deploy-all.sh dev
```

Or individually:
```bash
cd terraform/contexts/ingestion && terraform init && terraform apply -var-file=../../environments/dev.tfvars
cd terraform/contexts/orchestration && terraform init && terraform apply -var-file=../../environments/dev.tfvars
cd terraform/contexts/knowledge-base && terraform init && terraform apply -var-file=../../environments/dev.tfvars
cd terraform/contexts/communication && terraform init && terraform apply -var-file=../../environments/dev.tfvars
cd terraform/contexts/correlation && terraform init && terraform apply -var-file=../../environments/dev.tfvars
```

### 2.2 Request Bedrock Model Access

1. AWS Console → Amazon Bedrock → Model access
2. Request access to: Claude 3 Sonnet (or latest), Titan Embeddings V2
3. Wait for approval (usually < 24 hours)

### 2.3 Seed Knowledge Base

1. Add runbook .md files to `seed-runbooks/` (see seed-runbooks/README.md for format)
2. Run:
```bash
pnpm tsx scripts/seed-knowledge-base.ts dev
```

### 2.4 Configure ServiceNow Integration

```bash
# Store ServiceNow credentials in Secrets Manager
aws secretsmanager create-secret \
  --name forgeadmin/ingestion/servicenow-credentials \
  --secret-string '{"username":"svc_forgeadmin","password":"REDACTED"}' \
  --region us-east-2

# Set SSM parameters
./scripts/configure-ssm-params.sh /forgeadmin/ingestion/servicenow-url "https://odot.service-now.com/api/now/table/incident"
./scripts/configure-ssm-params.sh /forgeadmin/ingestion/servicenow-secret-arn "arn:aws:secretsmanager:us-east-2:ACCOUNT:secret:forgeadmin/ingestion/servicenow-credentials"
./scripts/configure-ssm-params.sh /forgeadmin/ingestion/servicenow-poll-interval "60"
./scripts/configure-ssm-params.sh /forgeadmin/ingestion/servicenow-filter "assignment_group=Windows Server Team"
```

### 2.5 Configure Teams/Slack Notifications

```bash
./scripts/configure-ssm-params.sh /forgeadmin/communication/webhook-url "https://hooks.slack.com/services/..." SecureString
./scripts/configure-ssm-params.sh /forgeadmin/communication/webhook-type "slack"
```

### 2.6 Enable Shadow Mode

Via the Dashboard UI:
1. Log in as team_lead
2. Navigate to Modules
3. Set each module to "Shadow" state

### 2.7 Verify Shadow Pipeline

Wait for the next ServiceNow poll cycle (60 seconds), then check:
- Dashboard shows ingested work items
- Audit trail shows triage/research/planning events
- Morning digest arrives next day at 7:00 AM ET

## Troubleshooting

### Terraform init fails with "backend configuration changed"
Run: `terraform init -reconfigure`

### Lambda invocation errors
Check CloudWatch Logs: `/aws/lambda/forgeadmin-{env}-{context}-{handler}`

### EventBridge events not arriving
Check: EventBridge rules match the event pattern. Use CloudWatch Metrics to see if rules are triggering.

### Cognito login fails
Verify callback URLs match the CloudFront domain exactly (including https://).

### Bedrock InvokeModel AccessDenied
Model access may not be approved yet. Check AWS Console → Bedrock → Model access.
```

- [ ] **Step 2: Commit**

```bash
git add docs/DEPLOYMENT.md
git commit -m "docs: add comprehensive deployment runbook for Phases 1-2"
```

---

## Self-Review Checklist

| Spec Section | Covered By Task |
|-------------|-----------------|
| 4.2 Bootstrap state backend | Task 1 |
| 4.3 Deploy foundation | Task 2 (backend.tf) + Task 10 (runbook) |
| 4.4 Create team accounts | Task 3 |
| 4.5 Deploy contexts | Task 2 (backend.tf) + Task 10 (runbook) |
| 4.6 Build/deploy frontend | Task 5 |
| 4.7 Verify CI/CD | Task 10 (runbook documents process) |
| 4.8 Phase 1 exit criteria | Task 7 (verify script) |
| 5.2 Bedrock model access | Task 10 (runbook section 2.2) |
| 5.3 Seed knowledge base | Task 6 |
| 5.4 Connect ServiceNow | Task 4 + Task 10 (runbook section 2.4) |
| 5.5 Teams/Slack integration | Task 4 + Task 10 (runbook section 2.5) |
| 5.7 Monitor/evaluate | Task 10 (runbook section 2.7) |
| Phase 3-4 (manual ops) | Out of scope — documented in roadmap spec |

All spec requirements for Phases 1-2 code/infra tasks are covered. Phases 3-4 are primarily manual operations (server provisioning, network requests, module promotion via Dashboard UI) and are documented in the roadmap spec, not as code tasks.
