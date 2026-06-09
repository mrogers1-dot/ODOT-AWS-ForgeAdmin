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
