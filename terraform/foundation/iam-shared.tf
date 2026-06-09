# =============================================================================
# Cross-Context IAM Roles — Least-Privilege Policies
# =============================================================================

# --- Lambda assume role policy (shared) ---

data "aws_iam_policy_document" "lambda_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

# --- EventBridge Publisher Role (assumed by context Lambdas) ---

resource "aws_iam_role" "eventbridge_publisher" {
  name               = "${var.project_name}-eventbridge-publisher"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json

  tags = {
    Name = "${var.project_name}-eventbridge-publisher"
  }
}

resource "aws_iam_policy" "eventbridge_publish" {
  name        = "${var.project_name}-eventbridge-publish"
  description = "Allow publishing events to the ForgeAdmin event bus"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["events:PutEvents"]
        Resource = [aws_cloudwatch_event_bus.main.arn]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "eventbridge_publisher" {
  role       = aws_iam_role.eventbridge_publisher.name
  policy_arn = aws_iam_policy.eventbridge_publish.arn
}

# --- Shared Lambda Execution Policy (CloudWatch Logs, X-Ray, Metrics) ---

resource "aws_iam_policy" "lambda_observability" {
  name        = "${var.project_name}-lambda-observability"
  description = "Shared observability permissions for all ForgeAdmin Lambdas"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:${var.aws_region}:*:log-group:/aws/lambda/${var.project_name}-*"
      },
      {
        Effect = "Allow"
        Action = [
          "xray:PutTraceSegments",
          "xray:PutTelemetryRecords",
          "xray:GetSamplingRules",
          "xray:GetSamplingTargets"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "cloudwatch:PutMetricData"
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "cloudwatch:namespace" = "ForgeAdmin"
          }
        }
      }
    ]
  })
}

# --- VPC Access Policy (for Lambdas in VPC) ---

resource "aws_iam_policy" "lambda_vpc_access" {
  name        = "${var.project_name}-lambda-vpc-access"
  description = "Allow Lambda functions to manage VPC network interfaces"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ec2:CreateNetworkInterface",
          "ec2:DescribeNetworkInterfaces",
          "ec2:DeleteNetworkInterface",
          "ec2:AssignPrivateIpAddresses",
          "ec2:UnassignPrivateIpAddresses"
        ]
        Resource = "*"
      }
    ]
  })
}

# --- SSM Parameter Read Policy (contexts read foundation outputs) ---

resource "aws_iam_policy" "ssm_parameter_read" {
  name        = "${var.project_name}-ssm-parameter-read"
  description = "Allow reading ForgeAdmin SSM parameters"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["ssm:GetParameter", "ssm:GetParameters", "ssm:GetParametersByPath"]
        Resource = "arn:aws:ssm:${var.aws_region}:*:parameter/${var.project_name}/*"
      }
    ]
  })
}
