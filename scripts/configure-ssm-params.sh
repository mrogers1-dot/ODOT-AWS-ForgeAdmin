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
