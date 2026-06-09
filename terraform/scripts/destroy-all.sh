#!/usr/bin/env bash
# =============================================================================
# destroy-all.sh — Destroy entire ForgeAdmin platform (contexts first, foundation last)
#
# Usage: ./destroy-all.sh [environment]
#   environment: dev (default), staging, prod
#
# WARNING: This destroys ALL resources. Use with caution.
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TERRAFORM_DIR="$SCRIPT_DIR/.."
ENVIRONMENT="${1:-dev}"
TFVARS_FILE="$TERRAFORM_DIR/environments/${ENVIRONMENT}.tfvars"

# --- Colors ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC} $*"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }

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

# --- Destroy a single module ---
destroy_module() {
  local module_dir="$1"
  local module_name
  module_name=$(basename "$module_dir")

  if [[ ! -d "$module_dir" ]] || [[ ! -f "$module_dir/main.tf" ]]; then
    log_warn "Skipping $module_name (no main.tf)"
    return 0
  fi

  log_info "Destroying: $module_name"

  cd "$module_dir"
  terraform init -input=false -reconfigure > /dev/null 2>&1 || true
  terraform destroy -var-file="$TFVARS_FILE" -auto-approve -input=false

  log_info "✓ $module_name destroyed"
}

# --- Main ---
main() {
  log_warn "=== ForgeAdmin DESTROY All ($ENVIRONMENT) ==="
  log_warn "This will destroy ALL ForgeAdmin resources."
  check_prerequisites

  # Step 1: Destroy all contexts in parallel (they depend on foundation)
  log_info "Step 1/2: Destroying contexts..."
  local contexts=(
    "$TERRAFORM_DIR/contexts/communication"
    "$TERRAFORM_DIR/contexts/dashboard"
    "$TERRAFORM_DIR/contexts/knowledge-base"
    "$TERRAFORM_DIR/contexts/execution"
    "$TERRAFORM_DIR/contexts/orchestration"
    "$TERRAFORM_DIR/contexts/ingestion"
    "$TERRAFORM_DIR/contexts/platform"
  )

  local pids=()
  for context_dir in "${contexts[@]}"; do
    destroy_module "$context_dir" &
    pids+=($!)
  done

  # Wait for all contexts
  local failed=0
  for pid in "${pids[@]}"; do
    if ! wait "$pid"; then
      failed=$((failed + 1))
    fi
  done

  if [[ $failed -gt 0 ]]; then
    log_error "$failed context(s) failed to destroy. Foundation NOT destroyed."
    exit 1
  fi

  # Step 2: Destroy foundation last
  log_info "Step 2/2: Destroying foundation..."
  destroy_module "$TERRAFORM_DIR/foundation"

  log_info "=== Destroy Complete ==="
}

main "$@"
