# =============================================================================
# Lambda — Execution Functions
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

# --- Execution Handler Lambda ---

resource "aws_lambda_function" "execution_handler" {
  function_name = "${var.project_name}-execution-handler"
  runtime       = "nodejs20.x"
  handler       = "index.handler"
  role          = aws_iam_role.execution_handler.arn
  timeout       = 120
  memory_size   = 512

  filename         = data.archive_file.placeholder.output_path
  source_code_hash = data.archive_file.placeholder.output_base64sha256

  environment {
    variables = {
      EVENTBRIDGE_BUS_NAME = local.eventbridge_bus_name
      TABLE_NAME           = aws_dynamodb_table.execution_state.name
      QUEUE_URL            = aws_sqs_queue.execution.url
      ENVIRONMENT          = var.environment
    }
  }

  tags = {
    Name = "${var.project_name}-execution-handler"
  }
}

# --- Callback Handler Lambda ---

resource "aws_lambda_function" "callback_handler" {
  function_name = "${var.project_name}-execution-callback-handler"
  runtime       = "nodejs20.x"
  handler       = "index.handler"
  role          = aws_iam_role.callback_handler.arn
  timeout       = 120
  memory_size   = 512

  filename         = data.archive_file.placeholder.output_path
  source_code_hash = data.archive_file.placeholder.output_base64sha256

  environment {
    variables = {
      EVENTBRIDGE_BUS_NAME = local.eventbridge_bus_name
      TABLE_NAME           = aws_dynamodb_table.execution_state.name
      QUEUE_URL            = aws_sqs_queue.execution.url
      ENVIRONMENT          = var.environment
    }
  }

  tags = {
    Name = "${var.project_name}-execution-callback-handler"
  }
}

# --- Timeout Handler Lambda ---

resource "aws_lambda_function" "timeout_handler" {
  function_name = "${var.project_name}-execution-timeout-handler"
  runtime       = "nodejs20.x"
  handler       = "index.handler"
  role          = aws_iam_role.timeout_handler.arn
  timeout       = 120
  memory_size   = 512

  filename         = data.archive_file.placeholder.output_path
  source_code_hash = data.archive_file.placeholder.output_base64sha256

  environment {
    variables = {
      EVENTBRIDGE_BUS_NAME = local.eventbridge_bus_name
      TABLE_NAME           = aws_dynamodb_table.execution_state.name
      QUEUE_URL            = aws_sqs_queue.execution.url
      ENVIRONMENT          = var.environment
    }
  }

  tags = {
    Name = "${var.project_name}-execution-timeout-handler"
  }
}
