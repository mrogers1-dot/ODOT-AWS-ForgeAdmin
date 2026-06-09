#!/usr/bin/env bash
# Validates the Terraform platform context module
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLATFORM_DIR="$SCRIPT_DIR/../contexts/platform"

errors=0

# --- Check required files exist ---
required_files=(
  "main.tf"
  "dynamodb.tf"
  "s3.tf"
  "cloudwatch.tf"
  "sns.tf"
  "lambda.tf"
)

for file in "${required_files[@]}"; do
  if [[ ! -f "$PLATFORM_DIR/$file" ]]; then
    echo "FAIL: Missing required file: $file"
    errors=$((errors + 1))
  else
    echo "PASS: $file exists"
  fi
done

# --- Terraform validate ---
if [[ $errors -eq 0 ]]; then
  echo ""
  echo "Running terraform validate..."
  cd "$PLATFORM_DIR"
  terraform init -backend=false -input=false > /dev/null 2>&1
  if terraform validate; then
    echo "PASS: terraform validate succeeded"
  else
    echo "FAIL: terraform validate failed"
    errors=$((errors + 1))
  fi
fi

# --- Check required resources ---
echo ""
echo "Checking required resource declarations..."

check_resource() {
  local file="$1"
  local pattern="$2"
  local desc="$3"
  if grep -q "$pattern" "$PLATFORM_DIR/$file" 2>/dev/null; then
    echo "PASS: $desc"
  else
    echo "FAIL: $desc not found in $file"
    errors=$((errors + 1))
  fi
}

check_resource "dynamodb.tf" 'resource "aws_dynamodb_table"' "DynamoDB audit trail table"
check_resource "dynamodb.tf" "actor-timestamp-index" "GSI: actor-timestamp-index"
check_resource "dynamodb.tf" "context-action-index" "GSI: context-action-index"
check_resource "dynamodb.tf" "stream_enabled" "DynamoDB Streams enabled"
check_resource "s3.tf" 'resource "aws_s3_bucket"' "S3 storage bucket"
check_resource "s3.tf" "force_destroy" "S3 force_destroy for POC"
check_resource "s3.tf" "transition" "S3 lifecycle transition"
check_resource "cloudwatch.tf" 'resource "aws_cloudwatch_dashboard"' "CloudWatch dashboard"
check_resource "cloudwatch.tf" 'resource "aws_cloudwatch_metric_alarm"' "CloudWatch alarms"
check_resource "sns.tf" 'resource "aws_sns_topic"' "SNS alarm topic"
check_resource "lambda.tf" 'resource "aws_lambda_function"' "Lambda functions"
check_resource "main.tf" "ssm_parameter" "SSM parameter lookups"

echo ""
if [[ $errors -gt 0 ]]; then
  echo "FAILED: $errors error(s) found"
  exit 1
else
  echo "ALL PASSED"
  exit 0
fi
