# =============================================================================
# IAM — Communication Lambda Roles
# =============================================================================

# --- Notification Dispatcher Role ---

resource "aws_iam_role" "notification_dispatcher" {
  name               = "${var.project_name}-communication-notification-dispatcher-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json

  tags = {
    Name = "${var.project_name}-communication-notification-dispatcher-role"
  }
}

resource "aws_iam_role_policy_attachment" "notification_dispatcher_observability" {
  role       = aws_iam_role.notification_dispatcher.name
  policy_arn = local.lambda_observability_policy_arn
}

resource "aws_iam_role_policy" "notification_dispatcher_access" {
  name = "${var.project_name}-communication-notification-dispatcher-access"
  role = aws_iam_role.notification_dispatcher.id

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
          aws_dynamodb_table.notification_state.arn,
          "${aws_dynamodb_table.notification_state.arn}/index/*"
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
          aws_sqs_queue.communication.arn,
          aws_sqs_queue.communication_dlq.arn
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

# --- Morning Digest Role ---

resource "aws_iam_role" "morning_digest" {
  name               = "${var.project_name}-communication-morning-digest-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json

  tags = {
    Name = "${var.project_name}-communication-morning-digest-role"
  }
}

resource "aws_iam_role_policy_attachment" "morning_digest_observability" {
  role       = aws_iam_role.morning_digest.name
  policy_arn = local.lambda_observability_policy_arn
}

resource "aws_iam_role_policy" "morning_digest_access" {
  name = "${var.project_name}-communication-morning-digest-access"
  role = aws_iam_role.morning_digest.id

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
          aws_dynamodb_table.notification_state.arn,
          "${aws_dynamodb_table.notification_state.arn}/index/*"
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
          aws_sqs_queue.communication.arn,
          aws_sqs_queue.communication_dlq.arn
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

# --- NL Command Handler Role ---

resource "aws_iam_role" "nl_command_handler" {
  name               = "${var.project_name}-communication-nl-command-handler-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json

  tags = {
    Name = "${var.project_name}-communication-nl-command-handler-role"
  }
}

resource "aws_iam_role_policy_attachment" "nl_command_handler_observability" {
  role       = aws_iam_role.nl_command_handler.name
  policy_arn = local.lambda_observability_policy_arn
}

resource "aws_iam_role_policy" "nl_command_handler_access" {
  name = "${var.project_name}-communication-nl-command-handler-access"
  role = aws_iam_role.nl_command_handler.id

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
          aws_dynamodb_table.notification_state.arn,
          "${aws_dynamodb_table.notification_state.arn}/index/*"
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
          aws_sqs_queue.communication.arn,
          aws_sqs_queue.communication_dlq.arn
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

# --- Escalation Handler Role ---

resource "aws_iam_role" "escalation_handler" {
  name               = "${var.project_name}-communication-escalation-handler-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json

  tags = {
    Name = "${var.project_name}-communication-escalation-handler-role"
  }
}

resource "aws_iam_role_policy_attachment" "escalation_handler_observability" {
  role       = aws_iam_role.escalation_handler.name
  policy_arn = local.lambda_observability_policy_arn
}

resource "aws_iam_role_policy" "escalation_handler_access" {
  name = "${var.project_name}-communication-escalation-handler-access"
  role = aws_iam_role.escalation_handler.id

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
          aws_dynamodb_table.notification_state.arn,
          "${aws_dynamodb_table.notification_state.arn}/index/*"
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
          aws_sqs_queue.communication.arn,
          aws_sqs_queue.communication_dlq.arn
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
