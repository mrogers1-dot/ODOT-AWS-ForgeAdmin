# =============================================================================
# Lambda — Correlation Functions
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

# --- On Work Item Created Lambda ---

resource "aws_lambda_function" "on_work_item_created" {
  function_name = "${var.project_name}-correlation-on-work-item-created"
  runtime       = "nodejs20.x"
  handler       = "index.handler"
  role          = aws_iam_role.on_work_item_created.arn
  timeout       = 30
  memory_size   = 256

  filename         = data.archive_file.placeholder.output_path
  source_code_hash = data.archive_file.placeholder.output_base64sha256

  environment {
    variables = {
      EVENTBRIDGE_BUS_NAME = local.eventbridge_bus_name
      SESSIONS_TABLE_NAME  = aws_dynamodb_table.correlation_sessions.name
      RULES_TABLE_NAME     = aws_dynamodb_table.correlation_rules.name
      QUEUE_URL            = aws_sqs_queue.correlation_input_buffer.url
      ENVIRONMENT          = var.environment
    }
  }

  tags = {
    Name = "${var.project_name}-correlation-on-work-item-created"
  }
}

# --- On Session Expired Lambda ---

resource "aws_lambda_function" "on_session_expired" {
  function_name = "${var.project_name}-correlation-on-session-expired"
  runtime       = "nodejs20.x"
  handler       = "index.handler"
  role          = aws_iam_role.on_session_expired.arn
  timeout       = 30
  memory_size   = 256

  filename         = data.archive_file.placeholder.output_path
  source_code_hash = data.archive_file.placeholder.output_base64sha256

  environment {
    variables = {
      EVENTBRIDGE_BUS_NAME = local.eventbridge_bus_name
      SESSIONS_TABLE_NAME  = aws_dynamodb_table.correlation_sessions.name
      RULES_TABLE_NAME     = aws_dynamodb_table.correlation_rules.name
      QUEUE_URL            = aws_sqs_queue.correlation_input_buffer.url
      ENVIRONMENT          = var.environment
    }
  }

  tags = {
    Name = "${var.project_name}-correlation-on-session-expired"
  }
}

# --- Sweeper Lambda ---

resource "aws_lambda_function" "sweeper" {
  function_name = "${var.project_name}-correlation-sweeper"
  runtime       = "nodejs20.x"
  handler       = "index.handler"
  role          = aws_iam_role.sweeper.arn
  timeout       = 30
  memory_size   = 256

  filename         = data.archive_file.placeholder.output_path
  source_code_hash = data.archive_file.placeholder.output_base64sha256

  environment {
    variables = {
      EVENTBRIDGE_BUS_NAME = local.eventbridge_bus_name
      SESSIONS_TABLE_NAME  = aws_dynamodb_table.correlation_sessions.name
      RULES_TABLE_NAME     = aws_dynamodb_table.correlation_rules.name
      QUEUE_URL            = aws_sqs_queue.correlation_input_buffer.url
      ENVIRONMENT          = var.environment
    }
  }

  tags = {
    Name = "${var.project_name}-correlation-sweeper"
  }
}

resource "aws_cloudwatch_event_rule" "sweeper_schedule" {
  name                = "${var.project_name}-correlation-sweeper-schedule"
  schedule_expression = "rate(5 minutes)"

  tags = {
    Name = "${var.project_name}-correlation-sweeper-schedule"
  }
}

resource "aws_cloudwatch_event_target" "sweeper_target" {
  rule = aws_cloudwatch_event_rule.sweeper_schedule.name
  arn  = aws_lambda_function.sweeper.arn
}

resource "aws_lambda_permission" "sweeper_eventbridge" {
  statement_id  = "AllowEventBridgeInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.sweeper.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.sweeper_schedule.arn
}
