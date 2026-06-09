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
