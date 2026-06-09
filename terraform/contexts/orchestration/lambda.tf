# =============================================================================
# Lambda — Orchestration Agent Functions
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

# --- Triage Agent Lambda ---

resource "aws_lambda_function" "triage_agent" {
  function_name = "${var.project_name}-orchestration-triage-agent"
  runtime       = "nodejs20.x"
  handler       = "index.handler"
  role          = aws_iam_role.triage_agent.arn
  timeout       = 60
  memory_size   = 512

  filename         = data.archive_file.placeholder.output_path
  source_code_hash = data.archive_file.placeholder.output_base64sha256

  environment {
    variables = {
      EVENTBRIDGE_BUS_NAME = local.eventbridge_bus_name
      TABLE_NAME           = aws_dynamodb_table.orchestration.name
      ENVIRONMENT          = var.environment
    }
  }

  tags = {
    Name = "${var.project_name}-orchestration-triage-agent"
  }
}

# --- Research Agent Lambda ---

resource "aws_lambda_function" "research_agent" {
  function_name = "${var.project_name}-orchestration-research-agent"
  runtime       = "nodejs20.x"
  handler       = "index.handler"
  role          = aws_iam_role.research_agent.arn
  timeout       = 60
  memory_size   = 512

  filename         = data.archive_file.placeholder.output_path
  source_code_hash = data.archive_file.placeholder.output_base64sha256

  environment {
    variables = {
      EVENTBRIDGE_BUS_NAME = local.eventbridge_bus_name
      TABLE_NAME           = aws_dynamodb_table.orchestration.name
      ENVIRONMENT          = var.environment
    }
  }

  tags = {
    Name = "${var.project_name}-orchestration-research-agent"
  }
}

# --- Planning Agent Lambda ---

resource "aws_lambda_function" "planning_agent" {
  function_name = "${var.project_name}-orchestration-planning-agent"
  runtime       = "nodejs20.x"
  handler       = "index.handler"
  role          = aws_iam_role.planning_agent.arn
  timeout       = 60
  memory_size   = 512

  filename         = data.archive_file.placeholder.output_path
  source_code_hash = data.archive_file.placeholder.output_base64sha256

  environment {
    variables = {
      EVENTBRIDGE_BUS_NAME = local.eventbridge_bus_name
      TABLE_NAME           = aws_dynamodb_table.orchestration.name
      ENVIRONMENT          = var.environment
    }
  }

  tags = {
    Name = "${var.project_name}-orchestration-planning-agent"
  }
}

# --- Verification Agent Lambda ---

resource "aws_lambda_function" "verification_agent" {
  function_name = "${var.project_name}-orchestration-verification-agent"
  runtime       = "nodejs20.x"
  handler       = "index.handler"
  role          = aws_iam_role.verification_agent.arn
  timeout       = 60
  memory_size   = 512

  filename         = data.archive_file.placeholder.output_path
  source_code_hash = data.archive_file.placeholder.output_base64sha256

  environment {
    variables = {
      EVENTBRIDGE_BUS_NAME = local.eventbridge_bus_name
      TABLE_NAME           = aws_dynamodb_table.orchestration.name
      ENVIRONMENT          = var.environment
    }
  }

  tags = {
    Name = "${var.project_name}-orchestration-verification-agent"
  }
}

# --- Supervisor Agent Lambda ---

resource "aws_lambda_function" "supervisor_agent" {
  function_name = "${var.project_name}-orchestration-supervisor-agent"
  runtime       = "nodejs20.x"
  handler       = "index.handler"
  role          = aws_iam_role.supervisor_agent.arn
  timeout       = 60
  memory_size   = 512

  filename         = data.archive_file.placeholder.output_path
  source_code_hash = data.archive_file.placeholder.output_base64sha256

  environment {
    variables = {
      EVENTBRIDGE_BUS_NAME = local.eventbridge_bus_name
      TABLE_NAME           = aws_dynamodb_table.orchestration.name
      ENVIRONMENT          = var.environment
    }
  }

  tags = {
    Name = "${var.project_name}-orchestration-supervisor-agent"
  }
}
