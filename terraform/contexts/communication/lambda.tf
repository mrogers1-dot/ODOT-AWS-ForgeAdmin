# =============================================================================
# Lambda — Communication Functions
# =============================================================================

data "aws_iam_policy_document" "lambda_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

data "archive_file" "placeholder" {
  type        = "zip"
  output_path = "${path.module}/placeholder.zip"

  source {
    content  = "exports.handler = async () => ({ statusCode: 200 });"
    filename = "index.js"
  }
}

# --- Notification Dispatcher Lambda ---

resource "aws_lambda_function" "notification_dispatcher" {
  function_name = "${var.project_name}-communication-notification-dispatcher"
  runtime       = "nodejs20.x"
  handler       = "index.handler"
  role          = aws_iam_role.notification_dispatcher.arn
  timeout       = 30
  memory_size   = 256

  filename         = data.archive_file.placeholder.output_path
  source_code_hash = data.archive_file.placeholder.output_base64sha256

  environment {
    variables = {
      EVENTBRIDGE_BUS_NAME = local.eventbridge_bus_name
      TABLE_NAME           = aws_dynamodb_table.notification_state.name
      QUEUE_URL            = aws_sqs_queue.communication.url
      ENVIRONMENT          = var.environment
    }
  }

  tags = {
    Name = "${var.project_name}-communication-notification-dispatcher"
  }
}

# --- Morning Digest Lambda ---

resource "aws_lambda_function" "morning_digest" {
  function_name = "${var.project_name}-communication-morning-digest"
  runtime       = "nodejs20.x"
  handler       = "index.handler"
  role          = aws_iam_role.morning_digest.arn
  timeout       = 30
  memory_size   = 256

  filename         = data.archive_file.placeholder.output_path
  source_code_hash = data.archive_file.placeholder.output_base64sha256

  environment {
    variables = {
      EVENTBRIDGE_BUS_NAME = local.eventbridge_bus_name
      TABLE_NAME           = aws_dynamodb_table.notification_state.name
      QUEUE_URL            = aws_sqs_queue.communication.url
      ENVIRONMENT          = var.environment
    }
  }

  tags = {
    Name = "${var.project_name}-communication-morning-digest"
  }
}

resource "aws_cloudwatch_event_rule" "morning_digest_schedule" {
  name                = "${var.project_name}-communication-morning-digest-schedule"
  schedule_expression = "cron(0 12 * * ? *)"

  tags = {
    Name = "${var.project_name}-communication-morning-digest-schedule"
  }
}

resource "aws_cloudwatch_event_target" "morning_digest_target" {
  rule = aws_cloudwatch_event_rule.morning_digest_schedule.name
  arn  = aws_lambda_function.morning_digest.arn
}

resource "aws_lambda_permission" "morning_digest_eventbridge" {
  statement_id  = "AllowEventBridgeInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.morning_digest.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.morning_digest_schedule.arn
}

# --- NL Command Handler Lambda ---

resource "aws_lambda_function" "nl_command_handler" {
  function_name = "${var.project_name}-communication-nl-command-handler"
  runtime       = "nodejs20.x"
  handler       = "index.handler"
  role          = aws_iam_role.nl_command_handler.arn
  timeout       = 30
  memory_size   = 256

  filename         = data.archive_file.placeholder.output_path
  source_code_hash = data.archive_file.placeholder.output_base64sha256

  environment {
    variables = {
      EVENTBRIDGE_BUS_NAME = local.eventbridge_bus_name
      TABLE_NAME           = aws_dynamodb_table.notification_state.name
      QUEUE_URL            = aws_sqs_queue.communication.url
      ENVIRONMENT          = var.environment
    }
  }

  tags = {
    Name = "${var.project_name}-communication-nl-command-handler"
  }
}

# --- Escalation Handler Lambda ---

resource "aws_lambda_function" "escalation_handler" {
  function_name = "${var.project_name}-communication-escalation-handler"
  runtime       = "nodejs20.x"
  handler       = "index.handler"
  role          = aws_iam_role.escalation_handler.arn
  timeout       = 30
  memory_size   = 256

  filename         = data.archive_file.placeholder.output_path
  source_code_hash = data.archive_file.placeholder.output_base64sha256

  environment {
    variables = {
      EVENTBRIDGE_BUS_NAME = local.eventbridge_bus_name
      TABLE_NAME           = aws_dynamodb_table.notification_state.name
      QUEUE_URL            = aws_sqs_queue.communication.url
      ENVIRONMENT          = var.environment
    }
  }

  tags = {
    Name = "${var.project_name}-communication-escalation-handler"
  }
}
