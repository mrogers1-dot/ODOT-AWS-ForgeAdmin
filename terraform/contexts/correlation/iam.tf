# =============================================================================
# IAM — Correlation Lambda Roles
# =============================================================================

# --- On Work Item Created Role ---

resource "aws_iam_role" "on_work_item_created" {
  name               = "${var.project_name}-correlation-on-work-item-created-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json

  tags = {
    Name = "${var.project_name}-correlation-on-work-item-created-role"
  }
}

resource "aws_iam_role_policy_attachment" "on_work_item_created_observability" {
  role       = aws_iam_role.on_work_item_created.name
  policy_arn = local.lambda_observability_policy_arn
}

resource "aws_iam_role_policy" "on_work_item_created_access" {
  name = "${var.project_name}-correlation-on-work-item-created-access"
  role = aws_iam_role.on_work_item_created.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:Query",
          "dynamodb:Scan"
        ]
        Resource = [
          aws_dynamodb_table.correlation_sessions.arn,
          "${aws_dynamodb_table.correlation_sessions.arn}/index/*",
          aws_dynamodb_table.correlation_rules.arn,
          "${aws_dynamodb_table.correlation_rules.arn}/index/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "sqs:SendMessage",
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes"
        ]
        Resource = [
          aws_sqs_queue.correlation_input_buffer.arn,
          aws_sqs_queue.correlation_dlq.arn
        ]
      },
      {
        Effect   = "Allow"
        Action   = ["events:PutEvents"]
        Resource = [local.eventbridge_bus_arn]
      },
      {
        Effect = "Allow"
        Action = [
          "scheduler:CreateSchedule",
          "scheduler:DeleteSchedule"
        ]
        Resource = ["*"]
      }
    ]
  })
}

# --- On Session Expired Role ---

resource "aws_iam_role" "on_session_expired" {
  name               = "${var.project_name}-correlation-on-session-expired-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json

  tags = {
    Name = "${var.project_name}-correlation-on-session-expired-role"
  }
}

resource "aws_iam_role_policy_attachment" "on_session_expired_observability" {
  role       = aws_iam_role.on_session_expired.name
  policy_arn = local.lambda_observability_policy_arn
}

resource "aws_iam_role_policy" "on_session_expired_access" {
  name = "${var.project_name}-correlation-on-session-expired-access"
  role = aws_iam_role.on_session_expired.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:Query",
          "dynamodb:Scan"
        ]
        Resource = [
          aws_dynamodb_table.correlation_sessions.arn,
          "${aws_dynamodb_table.correlation_sessions.arn}/index/*",
          aws_dynamodb_table.correlation_rules.arn,
          "${aws_dynamodb_table.correlation_rules.arn}/index/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "sqs:SendMessage",
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes"
        ]
        Resource = [
          aws_sqs_queue.correlation_input_buffer.arn,
          aws_sqs_queue.correlation_dlq.arn
        ]
      },
      {
        Effect   = "Allow"
        Action   = ["events:PutEvents"]
        Resource = [local.eventbridge_bus_arn]
      },
      {
        Effect = "Allow"
        Action = [
          "scheduler:CreateSchedule",
          "scheduler:DeleteSchedule"
        ]
        Resource = ["*"]
      }
    ]
  })
}

# --- Sweeper Role ---

resource "aws_iam_role" "sweeper" {
  name               = "${var.project_name}-correlation-sweeper-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json

  tags = {
    Name = "${var.project_name}-correlation-sweeper-role"
  }
}

resource "aws_iam_role_policy_attachment" "sweeper_observability" {
  role       = aws_iam_role.sweeper.name
  policy_arn = local.lambda_observability_policy_arn
}

resource "aws_iam_role_policy" "sweeper_access" {
  name = "${var.project_name}-correlation-sweeper-access"
  role = aws_iam_role.sweeper.id

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
          aws_dynamodb_table.correlation_sessions.arn,
          "${aws_dynamodb_table.correlation_sessions.arn}/index/*",
          aws_dynamodb_table.correlation_rules.arn,
          "${aws_dynamodb_table.correlation_rules.arn}/index/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "sqs:SendMessage",
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes"
        ]
        Resource = [
          aws_sqs_queue.correlation_input_buffer.arn,
          aws_sqs_queue.correlation_dlq.arn
        ]
      },
      {
        Effect   = "Allow"
        Action   = ["events:PutEvents"]
        Resource = [local.eventbridge_bus_arn]
      },
      {
        Effect = "Allow"
        Action = [
          "scheduler:CreateSchedule",
          "scheduler:DeleteSchedule"
        ]
        Resource = ["*"]
      }
    ]
  })
}
