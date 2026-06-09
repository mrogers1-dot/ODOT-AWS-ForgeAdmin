# =============================================================================
# Lambda — Ingestion Functions
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

# --- ServiceNow Poller Lambda ---

resource "aws_lambda_function" "servicenow_poller" {
  function_name = "${var.project_name}-ingestion-servicenow-poller"
  runtime       = "nodejs20.x"
  handler       = "index.handler"
  role          = aws_iam_role.servicenow_poller.arn
  timeout       = 30
  memory_size   = 256

  filename         = data.archive_file.placeholder.output_path
  source_code_hash = data.archive_file.placeholder.output_base64sha256

  environment {
    variables = {
      EVENTBRIDGE_BUS_NAME = local.eventbridge_bus_name
      TABLE_NAME           = aws_dynamodb_table.work_items.name
      ENVIRONMENT          = var.environment
    }
  }

  tags = {
    Name = "${var.project_name}-ingestion-servicenow-poller"
  }
}

resource "aws_cloudwatch_event_rule" "servicenow_poller_schedule" {
  name                = "${var.project_name}-ingestion-servicenow-poller-schedule"
  schedule_expression = "rate(5 minutes)"

  tags = {
    Name = "${var.project_name}-ingestion-servicenow-poller-schedule"
  }
}

resource "aws_cloudwatch_event_target" "servicenow_poller_target" {
  rule = aws_cloudwatch_event_rule.servicenow_poller_schedule.name
  arn  = aws_lambda_function.servicenow_poller.arn
}

resource "aws_lambda_permission" "servicenow_poller_eventbridge" {
  statement_id  = "AllowEventBridgeInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.servicenow_poller.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.servicenow_poller_schedule.arn
}

# --- SES Handler Lambda ---

resource "aws_lambda_function" "ses_handler" {
  function_name = "${var.project_name}-ingestion-ses-handler"
  runtime       = "nodejs20.x"
  handler       = "index.handler"
  role          = aws_iam_role.ses_handler.arn
  timeout       = 30
  memory_size   = 256

  filename         = data.archive_file.placeholder.output_path
  source_code_hash = data.archive_file.placeholder.output_base64sha256

  environment {
    variables = {
      EVENTBRIDGE_BUS_NAME = local.eventbridge_bus_name
      TABLE_NAME           = aws_dynamodb_table.work_items.name
      ENVIRONMENT          = var.environment
    }
  }

  tags = {
    Name = "${var.project_name}-ingestion-ses-handler"
  }
}

# --- FortiSIEM Webhook Lambda ---

resource "aws_lambda_function" "fortisiem_webhook" {
  function_name = "${var.project_name}-ingestion-fortisiem-webhook"
  runtime       = "nodejs20.x"
  handler       = "index.handler"
  role          = aws_iam_role.fortisiem_webhook.arn
  timeout       = 30
  memory_size   = 256

  filename         = data.archive_file.placeholder.output_path
  source_code_hash = data.archive_file.placeholder.output_base64sha256

  environment {
    variables = {
      EVENTBRIDGE_BUS_NAME = local.eventbridge_bus_name
      TABLE_NAME           = aws_dynamodb_table.work_items.name
      ENVIRONMENT          = var.environment
    }
  }

  tags = {
    Name = "${var.project_name}-ingestion-fortisiem-webhook"
  }
}
