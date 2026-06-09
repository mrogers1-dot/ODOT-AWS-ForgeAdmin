#!/usr/bin/env bash
# =============================================================================
# deploy-all.sh — Deploy ForgeAdmin platform (foundation first, contexts parallel)
#
# Usage: ./deploy-all.sh [environment]
#   environment: dev (default), staging, prod
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

  log_info "Prerequisites OK (terraform, aws CLI, $ENVIRONMENT.tfvars)"
}

# --- Deploy a single module ---
deploy_module() {
  local module_dir="$1"
  local module_name
  module_name=$(basename "$module_dir")

  log_info "Deploying: $module_name"

  cd "$module_dir"
  terraform init -input=false -reconfigure > /dev/null 2>&1
  terraform plan -var-file="$TFVARS_FILE" -out=tfplan -input=false > /dev/null 2>&1
  terraform apply -input=false tfplan
  rm -f tfplan

  log_info "✓ $module_name deployed"
}

# --- Main ---
main() {
  log_info "=== ForgeAdmin Deploy All ($ENVIRONMENT) ==="
  check_prerequisites

  # Step 1: Deploy foundation first (all contexts depend on it)
  log_info "Step 1/2: Deploying foundation..."
  deploy_module "$TERRAFORM_DIR/foundation"

  # Step 2: Deploy all contexts in parallel
  log_info "Step 2/2: Deploying contexts..."
  local contexts=(
    "$TERRAFORM_DIR/contexts/platform"
    "$TERRAFORM_DIR/contexts/ingestion"
    "$TERRAFORM_DIR/contexts/orchestration"
    "$TERRAFORM_DIR/contexts/execution"
    "$TERRAFORM_DIR/contexts/knowledge-base"
    "$TERRAFORM_DIR/contexts/dashboard"
    "$TERRAFORM_DIR/contexts/communication"
  )

  local pids=()
  for context_dir in "${contexts[@]}"; do
    if [[ -d "$context_dir" ]] && [[ -f "$context_dir/main.tf" ]]; then
      deploy_module "$context_dir" &
      pids+=($!)
    fi
  done

  # Wait for all contexts
  local failed=0
  for pid in "${pids[@]}"; do
    if ! wait "$pid"; then
      failed=$((failed + 1))
    fi
  done

  if [[ $failed -gt 0 ]]; then
    log_error "$failed context(s) failed to deploy"
    exit 1
  fi

  log_info "=== Deploy Complete ==="
}

main "$@"
