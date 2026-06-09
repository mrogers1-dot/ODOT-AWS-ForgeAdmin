#!/usr/bin/env bash
# =============================================================================
# destroy-context.sh — Destroy a single ForgeAdmin context
#
# Usage: ./destroy-context.sh <context-name> [environment]
#   context-name: ingestion, orchestration, execution, knowledge-base,
#                 dashboard, communication, platform
#   environment:  dev (default), staging, prod
#
# Example: ./destroy-context.sh ingestion dev
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TERRAFORM_DIR="$SCRIPT_DIR/.."
CONTEXT_NAME="${1:-}"
ENVIRONMENT="${2:-dev}"
TFVARS_FILE="$TERRAFORM_DIR/environments/${ENVIRONMENT}.tfvars"

# --- Colors ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC} $*"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }

# --- Usage ---
usage() {
  echo "Usage: $0 <context-name> [environment]"
  echo ""
  echo "Valid contexts: ingestion, orchestration, execution, knowledge-base,"
  echo "                dashboard, communication, platform"
  echo ""
  echo "Environment: dev (default), staging, prod"
  exit 1
}

# --- Prerequisite checks ---
check_prerequisites() {
  local missing=0

  if ! command -v terraform &> /dev/null; then
    log_error "terraform is not installed"
    missing=$((missing + 1))
  fi

  if ! command -v aws &> /dev/null; then
    log_error "aws CLI is not installed"
    missing=$((missing + 1))
  fi

  if [[ ! -f "$TFVARS_FILE" ]]; then
    log_error "Environment file not found: $TFVARS_FILE"
    missing=$((missing + 1))
  fi

  if [[ $missing -gt 0 ]]; then
    log_error "Prerequisites not met. Aborting."
    exit 1
  fi
}

# --- Validate context name ---
validate_context() {
  local valid_contexts=("ingestion" "orchestration" "execution" "knowledge-base" "dashboard" "communication" "platform")

  for valid in "${valid_contexts[@]}"; do
    if [[ "$CONTEXT_NAME" == "$valid" ]]; then
      return 0
    fi
  done

  log_error "Invalid context: $CONTEXT_NAME"
  usage
}

# --- Main ---
main() {
  if [[ -z "$CONTEXT_NAME" ]]; then
    log_error "Context name is required"
    usage
  fi

  validate_context
  check_prerequisites

  local context_dir="$TERRAFORM_DIR/contexts/$CONTEXT_NAME"

  if [[ ! -d "$context_dir" ]] || [[ ! -f "$context_dir/main.tf" ]]; then
    log_error "Context directory not found or empty: $context_dir"
    exit 1
  fi

  log_warn "=== Destroying context: $CONTEXT_NAME ($ENVIRONMENT) ==="

  cd "$context_dir"
  terraform init -input=false -reconfigure > /dev/null 2>&1 || true
  terraform destroy -var-file="$TFVARS_FILE" -auto-approve -input=false

  log_info "✓ Context '$CONTEXT_NAME' destroyed"
}

main "$@"
