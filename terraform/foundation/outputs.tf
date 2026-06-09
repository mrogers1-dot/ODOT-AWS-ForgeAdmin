# =============================================================================
# Outputs — Published via SSM Parameters for Context Consumption
# =============================================================================

# --- EventBridge ---

output "eventbridge_bus_arn" {
  description = "ARN of the ForgeAdmin custom event bus"
  value       = aws_cloudwatch_event_bus.main.arn
}

output "eventbridge_bus_name" {
  description = "Name of the ForgeAdmin custom event bus"
  value       = aws_cloudwatch_event_bus.main.name
}

output "schema_registry_name" {
  description = "Name of the EventBridge Schema Registry"
  value       = aws_schemas_registry.main.name
}

# --- VPC ---

output "vpc_id" {
  description = "VPC ID"
  value       = aws_vpc.main.id
}

output "private_subnet_ids" {
  description = "List of private subnet IDs"
  value       = aws_subnet.private[*].id
}

output "public_subnet_ids" {
  description = "List of public subnet IDs"
  value       = aws_subnet.public[*].id
}

output "lambda_security_group_id" {
  description = "Security group ID for Lambda functions"
  value       = aws_security_group.lambda.id
}

# --- Cognito ---

output "cognito_user_pool_id" {
  description = "Cognito User Pool ID"
  value       = aws_cognito_user_pool.main.id
}

output "cognito_user_pool_arn" {
  description = "Cognito User Pool ARN"
  value       = aws_cognito_user_pool.main.arn
}

output "cognito_client_id" {
  description = "Cognito User Pool Client ID for the dashboard"
  value       = aws_cognito_user_pool_client.dashboard.id
}

# --- IAM ---

output "eventbridge_publisher_role_arn" {
  description = "IAM role ARN for EventBridge publishing"
  value       = aws_iam_role.eventbridge_publisher.arn
}

output "lambda_observability_policy_arn" {
  description = "IAM policy ARN for Lambda observability"
  value       = aws_iam_policy.lambda_observability.arn
}

output "lambda_vpc_access_policy_arn" {
  description = "IAM policy ARN for Lambda VPC access"
  value       = aws_iam_policy.lambda_vpc_access.arn
}

output "ssm_parameter_read_policy_arn" {
  description = "IAM policy ARN for SSM parameter reads"
  value       = aws_iam_policy.ssm_parameter_read.arn
}

# =============================================================================
# SSM Parameters — Cross-Context Discovery
# =============================================================================

resource "aws_ssm_parameter" "eventbridge_bus_arn" {
  name  = "/${var.project_name}/foundation/eventbridge-bus-arn"
  type  = "String"
  value = aws_cloudwatch_event_bus.main.arn

  tags = { Name = "${var.project_name}-eventbridge-bus-arn" }
}

resource "aws_ssm_parameter" "eventbridge_bus_name" {
  name  = "/${var.project_name}/foundation/eventbridge-bus-name"
  type  = "String"
  value = aws_cloudwatch_event_bus.main.name

  tags = { Name = "${var.project_name}-eventbridge-bus-name" }
}

resource "aws_ssm_parameter" "vpc_id" {
  name  = "/${var.project_name}/foundation/vpc-id"
  type  = "String"
  value = aws_vpc.main.id

  tags = { Name = "${var.project_name}-vpc-id" }
}

resource "aws_ssm_parameter" "private_subnet_ids" {
  name  = "/${var.project_name}/foundation/private-subnet-ids"
  type  = "StringList"
  value = join(",", aws_subnet.private[*].id)

  tags = { Name = "${var.project_name}-private-subnet-ids" }
}

resource "aws_ssm_parameter" "lambda_security_group_id" {
  name  = "/${var.project_name}/foundation/lambda-security-group-id"
  type  = "String"
  value = aws_security_group.lambda.id

  tags = { Name = "${var.project_name}-lambda-security-group-id" }
}

resource "aws_ssm_parameter" "cognito_user_pool_id" {
  name  = "/${var.project_name}/foundation/cognito-user-pool-id"
  type  = "String"
  value = aws_cognito_user_pool.main.id

  tags = { Name = "${var.project_name}-cognito-user-pool-id" }
}

resource "aws_ssm_parameter" "cognito_client_id" {
  name  = "/${var.project_name}/foundation/cognito-client-id"
  type  = "String"
  value = aws_cognito_user_pool_client.dashboard.id

  tags = { Name = "${var.project_name}-cognito-client-id" }
}

resource "aws_ssm_parameter" "eventbridge_publisher_role_arn" {
  name  = "/${var.project_name}/foundation/eventbridge-publisher-role-arn"
  type  = "String"
  value = aws_iam_role.eventbridge_publisher.arn

  tags = { Name = "${var.project_name}-eventbridge-publisher-role-arn" }
}

resource "aws_ssm_parameter" "lambda_observability_policy_arn" {
  name  = "/${var.project_name}/foundation/lambda-observability-policy-arn"
  type  = "String"
  value = aws_iam_policy.lambda_observability.arn

  tags = { Name = "${var.project_name}-lambda-observability-policy-arn" }
}

resource "aws_ssm_parameter" "lambda_vpc_access_policy_arn" {
  name  = "/${var.project_name}/foundation/lambda-vpc-access-policy-arn"
  type  = "String"
  value = aws_iam_policy.lambda_vpc_access.arn

  tags = { Name = "${var.project_name}-lambda-vpc-access-policy-arn" }
}
