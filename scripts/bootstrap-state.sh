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
