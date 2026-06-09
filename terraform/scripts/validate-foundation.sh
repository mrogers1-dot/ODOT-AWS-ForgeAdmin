#!/usr/bin/env bash
# Validates the Terraform foundation module contains all required resources
# and passes `terraform validate`.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FOUNDATION_DIR="$SCRIPT_DIR/../foundation"

errors=0

# --- Check required files exist ---
required_files=(
  "main.tf"
  "variables.tf"
  "outputs.tf"
  "eventbridge.tf"
  "networking.tf"
  "iam-shared.tf"
  "cognito.tf"
)

for file in "${required_files[@]}"; do
  if [[ ! -f "$FOUNDATION_DIR/$file" ]]; then
    echo "FAIL: Missing required file: $file"
    errors=$((errors + 1))
  else
    echo "PASS: $file exists"
  fi
done

# --- Check dev.tfvars exists ---
if [[ ! -f "$SCRIPT_DIR/../environments/dev.tfvars" ]]; then
  echo "FAIL: Missing terraform/environments/dev.tfvars"
  errors=$((errors + 1))
else
  echo "PASS: dev.tfvars exists"
fi

# --- Terraform validate (skip if files missing) ---
if [[ $errors -eq 0 ]]; then
  echo ""
  echo "Running terraform validate..."
  cd "$FOUNDATION_DIR"
  # Initialize with no backend for validation only
  terraform init -backend=false -input=false > /dev/null 2>&1
  if terraform validate; then
    echo "PASS: terraform validate succeeded"
  else
    echo "FAIL: terraform validate failed"
    errors=$((errors + 1))
  fi
fi

# --- Check required resources exist in HCL ---
echo ""
echo "Checking required resource declarations..."

check_resource() {
  local file="$1"
  local pattern="$2"
  local desc="$3"
  if grep -q "$pattern" "$FOUNDATION_DIR/$file" 2>/dev/null; then
    echo "PASS: $desc"
  else
    echo "FAIL: $desc not found in $file"
    errors=$((errors + 1))
  fi
}

check_resource "eventbridge.tf" 'resource "aws_cloudwatch_event_bus"' "EventBridge custom event bus"
check_resource "eventbridge.tf" 'resource "aws_schemas_registry"' "Schema Registry"
check_resource "networking.tf" 'resource "aws_vpc"' "VPC"
check_resource "networking.tf" 'resource "aws_subnet"' "Subnets"
check_resource "networking.tf" 'resource "aws_security_group"' "Security groups"
check_resource "iam-shared.tf" 'resource "aws_iam_role"' "IAM roles"
check_resource "iam-shared.tf" 'resource "aws_iam_policy"' "IAM policies"
check_resource "cognito.tf" 'resource "aws_cognito_user_pool"' "Cognito User Pool"
check_resource "cognito.tf" 'aws_cognito_user_group' "Cognito user groups (team_lead/team_member)"
check_resource "outputs.tf" 'resource "aws_ssm_parameter"' "SSM parameters for cross-context discovery"

echo ""
if [[ $errors -gt 0 ]]; then
  echo "FAILED: $errors error(s) found"
  exit 1
else
  echo "ALL PASSED"
  exit 0
fi
