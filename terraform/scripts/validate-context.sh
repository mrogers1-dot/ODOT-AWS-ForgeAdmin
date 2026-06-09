#!/usr/bin/env bash
# =============================================================================
# validate-context.sh — Validate a single Terraform context module
#
# Usage: ./validate-context.sh <context-name>
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTEXT_NAME="${1:-}"

if [[ -z "$CONTEXT_NAME" ]]; then
  echo "Usage: $0 <context-name>"
  exit 1
fi

CONTEXT_DIR="$SCRIPT_DIR/../contexts/$CONTEXT_NAME"

if [[ ! -d "$CONTEXT_DIR" ]]; then
  echo "FAIL: Directory not found: $CONTEXT_DIR"
  exit 1
fi

errors=0

# --- Check main.tf exists ---
if [[ ! -f "$CONTEXT_DIR/main.tf" ]]; then
  echo "FAIL: Missing main.tf in $CONTEXT_NAME"
  errors=$((errors + 1))
else
  echo "PASS: main.tf exists"
fi

# --- Terraform validate ---
echo ""
echo "Running terraform init + validate for $CONTEXT_NAME..."
cd "$CONTEXT_DIR"
if terraform init -backend=false -input=false > /dev/null 2>&1; then
  if terraform validate; then
    echo "PASS: terraform validate succeeded"
  else
    echo "FAIL: terraform validate failed"
    errors=$((errors + 1))
  fi
else
  echo "FAIL: terraform init failed"
  errors=$((errors + 1))
fi

# --- Check terraform fmt ---
echo ""
if terraform fmt -check -diff > /dev/null 2>&1; then
  echo "PASS: terraform fmt clean"
else
  echo "FAIL: terraform fmt shows differences"
  errors=$((errors + 1))
fi

echo ""
if [[ $errors -gt 0 ]]; then
  echo "FAILED: $CONTEXT_NAME — $errors error(s)"
  exit 1
else
  echo "ALL PASSED: $CONTEXT_NAME"
  exit 0
fi
