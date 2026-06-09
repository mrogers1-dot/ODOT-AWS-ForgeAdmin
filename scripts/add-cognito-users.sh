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
