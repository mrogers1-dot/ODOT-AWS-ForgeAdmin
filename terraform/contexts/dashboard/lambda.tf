# =============================================================================
# Lambda — Dashboard Functions
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

# --- API Handler Lambda ---

resource "aws_lambda_function" "api_handler" {
  function_name = "${var.project_name}-dashboard-api-handler"
  runtime       = "nodejs20.x"
  handler       = "index.handler"
  role          = aws_iam_role.api_handler.arn
  timeout       = 30
  memory_size   = 256

  filename         = data.archive_file.placeholder.output_path
  source_code_hash = data.archive_file.placeholder.output_base64sha256

  environment {
    variables = {
      EVENTBRIDGE_BUS_NAME = local.eventbridge_bus_name
      TABLE_NAME           = aws_dynamodb_table.dashboard.name
      ENVIRONMENT          = var.environment
    }
  }

  tags = {
    Name = "${var.project_name}-dashboard-api-handler"
  }
}

# --- WebSocket Connect Lambda ---

resource "aws_lambda_function" "websocket_connect" {
  function_name = "${var.project_name}-dashboard-websocket-connect"
  runtime       = "nodejs20.x"
  handler       = "index.handler"
  role          = aws_iam_role.websocket_connect.arn
  timeout       = 30
  memory_size   = 256

  filename         = data.archive_file.placeholder.output_path
  source_code_hash = data.archive_file.placeholder.output_base64sha256

  environment {
    variables = {
      EVENTBRIDGE_BUS_NAME = local.eventbridge_bus_name
      TABLE_NAME           = aws_dynamodb_table.dashboard.name
      ENVIRONMENT          = var.environment
    }
  }

  tags = {
    Name = "${var.project_name}-dashboard-websocket-connect"
  }
}

# --- WebSocket Disconnect Lambda ---

resource "aws_lambda_function" "websocket_disconnect" {
  function_name = "${var.project_name}-dashboard-websocket-disconnect"
  runtime       = "nodejs20.x"
  handler       = "index.handler"
  role          = aws_iam_role.websocket_disconnect.arn
  timeout       = 30
  memory_size   = 256

  filename         = data.archive_file.placeholder.output_path
  source_code_hash = data.archive_file.placeholder.output_base64sha256

  environment {
    variables = {
      EVENTBRIDGE_BUS_NAME = local.eventbridge_bus_name
      TABLE_NAME           = aws_dynamodb_table.dashboard.name
      ENVIRONMENT          = var.environment
    }
  }

  tags = {
    Name = "${var.project_name}-dashboard-websocket-disconnect"
  }
}
