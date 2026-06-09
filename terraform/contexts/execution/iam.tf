# =============================================================================
# IAM — Execution Lambda Roles
# =============================================================================

# --- Execution Handler Role ---

resource "aws_iam_role" "execution_handler" {
  name               = "${var.project_name}-execution-handler-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json

  tags = {
    Name = "${var.project_name}-execution-handler-role"
  }
}

resource "aws_iam_role_policy_attachment" "execution_handler_observability" {
  role       = aws_iam_role.execution_handler.name
  policy_arn = local.lambda_observability_policy_arn
}

resource "aws_iam_role_policy" "execution_handler_access" {
  name = "${var.project_name}-execution-handler-access"
  role = aws_iam_role.execution_handler.id

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
          aws_dynamodb_table.execution_state.arn,
          "${aws_dynamodb_table.execution_state.arn}/index/*"
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
          aws_sqs_queue.execution.arn,
          aws_sqs_queue.execution_dlq.arn
        ]
      },
      {
        Effect   = "Allow"
        Action   = ["events:PutEvents"]
        Resource = [local.eventbridge_bus_arn]
      },
      {
        Effect   = "Allow"
        Action   = ["secretsmanager:GetSecretValue"]
        Resource = ["arn:aws:secretsmanager:${var.aws_region}:*:secret:${var.project_name}/*"]
      }
    ]
  })
}

# --- Callback Handler Role ---

resource "aws_iam_role" "callback_handler" {
  name               = "${var.project_name}-execution-callback-handler-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json

  tags = {
    Name = "${var.project_name}-execution-callback-handler-role"
  }
}

resource "aws_iam_role_policy_attachment" "callback_handler_observability" {
  role       = aws_iam_role.callback_handler.name
  policy_arn = local.lambda_observability_policy_arn
}

resource "aws_iam_role_policy" "callback_handler_access" {
  name = "${var.project_name}-execution-callback-handler-access"
  role = aws_iam_role.callback_handler.id

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
          aws_dynamodb_table.execution_state.arn,
          "${aws_dynamodb_table.execution_state.arn}/index/*"
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
          aws_sqs_queue.execution.arn,
          aws_sqs_queue.execution_dlq.arn
        ]
      },
      {
        Effect   = "Allow"
        Action   = ["events:PutEvents"]
        Resource = [local.eventbridge_bus_arn]
      },
      {
        Effect   = "Allow"
        Action   = ["secretsmanager:GetSecretValue"]
        Resource = ["arn:aws:secretsmanager:${var.aws_region}:*:secret:${var.project_name}/*"]
      }
    ]
  })
}

# --- Timeout Handler Role ---

resource "aws_iam_role" "timeout_handler" {
  name               = "${var.project_name}-execution-timeout-handler-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json

  tags = {
    Name = "${var.project_name}-execution-timeout-handler-role"
  }
}

resource "aws_iam_role_policy_attachment" "timeout_handler_observability" {
  role       = aws_iam_role.timeout_handler.name
  policy_arn = local.lambda_observability_policy_arn
}

resource "aws_iam_role_policy" "timeout_handler_access" {
  name = "${var.project_name}-execution-timeout-handler-access"
  role = aws_iam_role.timeout_handler.id

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
          aws_dynamodb_table.execution_state.arn,
          "${aws_dynamodb_table.execution_state.arn}/index/*"
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
          aws_sqs_queue.execution.arn,
          aws_sqs_queue.execution_dlq.arn
        ]
      },
      {
        Effect   = "Allow"
        Action   = ["events:PutEvents"]
        Resource = [local.eventbridge_bus_arn]
      },
      {
        Effect   = "Allow"
        Action   = ["secretsmanager:GetSecretValue"]
        Resource = ["arn:aws:secretsmanager:${var.aws_region}:*:secret:${var.project_name}/*"]
      }
    ]
  })
}
