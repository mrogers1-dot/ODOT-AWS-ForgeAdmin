#!/usr/bin/env bash
# Validates deployment scripts exist and pass shellcheck/syntax checks
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
errors=0

# --- Check required scripts exist ---
required_scripts=(
  "deploy-all.sh"
  "destroy-all.sh"
  "destroy-context.sh"
)

for script in "${required_scripts[@]}"; do
  if [[ ! -f "$SCRIPT_DIR/$script" ]]; then
    echo "FAIL: Missing script: $script"
    errors=$((errors + 1))
  else
    echo "PASS: $script exists"

    # Check executable
    if [[ ! -x "$SCRIPT_DIR/$script" ]]; then
      echo "FAIL: $script is not executable"
      errors=$((errors + 1))
    else
      echo "PASS: $script is executable"
    fi

    # Syntax check
    if bash -n "$SCRIPT_DIR/$script" 2>/dev/null; then
      echo "PASS: $script syntax valid"
    else
      echo "FAIL: $script has syntax errors"
      errors=$((errors + 1))
    fi

    # Check for set -euo pipefail
    if grep -q "set -euo pipefail" "$SCRIPT_DIR/$script"; then
      echo "PASS: $script uses strict mode"
    else
      echo "FAIL: $script missing 'set -euo pipefail'"
      errors=$((errors + 1))
    fi

    # Check for prerequisite validation
    if grep -q "terraform" "$SCRIPT_DIR/$script" && grep -q "aws" "$SCRIPT_DIR/$script"; then
      echo "PASS: $script checks prerequisites"
    else
      echo "FAIL: $script missing prerequisite checks"
      errors=$((errors + 1))
    fi
  fi
  echo ""
done

# --- Check deploy-all deploys foundation first ---
if grep -q "foundation" "$SCRIPT_DIR/deploy-all.sh" 2>/dev/null; then
  echo "PASS: deploy-all.sh references foundation"
else
  echo "FAIL: deploy-all.sh doesn't reference foundation"
  errors=$((errors + 1))
fi

# --- Check destroy-all destroys foundation last ---
if grep -q "foundation" "$SCRIPT_DIR/destroy-all.sh" 2>/dev/null; then
  echo "PASS: destroy-all.sh references foundation"
else
  echo "FAIL: destroy-all.sh doesn't reference foundation"
  errors=$((errors + 1))
fi

# --- Check destroy-context accepts argument ---
if grep -q '\$1\|"$1"\|${1' "$SCRIPT_DIR/destroy-context.sh" 2>/dev/null; then
  echo "PASS: destroy-context.sh accepts context argument"
else
  echo "FAIL: destroy-context.sh doesn't accept context argument"
  errors=$((errors + 1))
fi

echo ""
if [[ $errors -gt 0 ]]; then
  echo "FAILED: $errors error(s) found"
  exit 1
else
  echo "ALL PASSED"
  exit 0
fi
