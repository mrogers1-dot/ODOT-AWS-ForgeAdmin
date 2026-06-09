# =============================================================================
# IAM — Ingestion Lambda Roles
# =============================================================================

# --- ServiceNow Poller Role ---

resource "aws_iam_role" "servicenow_poller" {
  name               = "${var.project_name}-ingestion-servicenow-poller-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json

  tags = {
    Name = "${var.project_name}-ingestion-servicenow-poller-role"
  }
}

resource "aws_iam_role_policy_attachment" "servicenow_poller_observability" {
  role       = aws_iam_role.servicenow_poller.name
  policy_arn = local.lambda_observability_policy_arn
}

resource "aws_iam_role_policy" "servicenow_poller_access" {
  name = "${var.project_name}-ingestion-servicenow-poller-access"
  role = aws_iam_role.servicenow_poller.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan"
        ]
        Resource = [
          aws_dynamodb_table.work_items.arn,
          "${aws_dynamodb_table.work_items.arn}/index/*"
        ]
      },
      {
        Effect   = "Allow"
        Action   = ["events:PutEvents"]
        Resource = [local.eventbridge_bus_arn]
      }
    ]
  })
}

# --- SES Handler Role ---

resource "aws_iam_role" "ses_handler" {
  name               = "${var.project_name}-ingestion-ses-handler-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json

  tags = {
    Name = "${var.project_name}-ingestion-ses-handler-role"
  }
}

resource "aws_iam_role_policy_attachment" "ses_handler_observability" {
  role       = aws_iam_role.ses_handler.name
  policy_arn = local.lambda_observability_policy_arn
}

resource "aws_iam_role_policy" "ses_handler_access" {
  name = "${var.project_name}-ingestion-ses-handler-access"
  role = aws_iam_role.ses_handler.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan"
        ]
        Resource = [
          aws_dynamodb_table.work_items.arn,
          "${aws_dynamodb_table.work_items.arn}/index/*"
        ]
      },
      {
        Effect   = "Allow"
        Action   = ["events:PutEvents"]
        Resource = [local.eventbridge_bus_arn]
      }
    ]
  })
}

# --- FortiSIEM Webhook Role ---

resource "aws_iam_role" "fortisiem_webhook" {
  name               = "${var.project_name}-ingestion-fortisiem-webhook-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json

  tags = {
    Name = "${var.project_name}-ingestion-fortisiem-webhook-role"
  }
}

resource "aws_iam_role_policy_attachment" "fortisiem_webhook_observability" {
  role       = aws_iam_role.fortisiem_webhook.name
  policy_arn = local.lambda_observability_policy_arn
}

resource "aws_iam_role_policy" "fortisiem_webhook_access" {
  name = "${var.project_name}-ingestion-fortisiem-webhook-access"
  role = aws_iam_role.fortisiem_webhook.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan"
        ]
        Resource = [
          aws_dynamodb_table.work_items.arn,
          "${aws_dynamodb_table.work_items.arn}/index/*"
        ]
      },
      {
        Effect   = "Allow"
        Action   = ["events:PutEvents"]
        Resource = [local.eventbridge_bus_arn]
      }
    ]
  })
}
