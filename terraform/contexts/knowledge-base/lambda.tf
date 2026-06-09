# =============================================================================
# Lambda — Knowledge Base Functions
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

# --- KB Query Handler Lambda ---

resource "aws_lambda_function" "kb_query_handler" {
  function_name = "${var.project_name}-knowledge-base-kb-query-handler"
  runtime       = "nodejs20.x"
  handler       = "index.handler"
  role          = aws_iam_role.kb_query_handler.arn
  timeout       = 60
  memory_size   = 512

  filename         = data.archive_file.placeholder.output_path
  source_code_hash = data.archive_file.placeholder.output_base64sha256

  environment {
    variables = {
      EVENTBRIDGE_BUS_NAME    = local.eventbridge_bus_name
      TABLE_NAME              = aws_dynamodb_table.knowledge_gap_tracker.name
      SOURCE_DOCUMENTS_BUCKET = aws_s3_bucket.kb_source_documents.id
      RUNBOOKS_BUCKET         = aws_s3_bucket.runbooks.id
      ENVIRONMENT             = var.environment
    }
  }

  tags = {
    Name = "${var.project_name}-knowledge-base-kb-query-handler"
  }
}

# --- Runbook Generator Lambda ---

resource "aws_lambda_function" "runbook_generator" {
  function_name = "${var.project_name}-knowledge-base-runbook-generator"
  runtime       = "nodejs20.x"
  handler       = "index.handler"
  role          = aws_iam_role.runbook_generator.arn
  timeout       = 60
  memory_size   = 512

  filename         = data.archive_file.placeholder.output_path
  source_code_hash = data.archive_file.placeholder.output_base64sha256

  environment {
    variables = {
      EVENTBRIDGE_BUS_NAME    = local.eventbridge_bus_name
      TABLE_NAME              = aws_dynamodb_table.knowledge_gap_tracker.name
      SOURCE_DOCUMENTS_BUCKET = aws_s3_bucket.kb_source_documents.id
      RUNBOOKS_BUCKET         = aws_s3_bucket.runbooks.id
      ENVIRONMENT             = var.environment
    }
  }

  tags = {
    Name = "${var.project_name}-knowledge-base-runbook-generator"
  }
}

# --- KB Updater Lambda ---

resource "aws_lambda_function" "kb_updater" {
  function_name = "${var.project_name}-knowledge-base-kb-updater"
  runtime       = "nodejs20.x"
  handler       = "index.handler"
  role          = aws_iam_role.kb_updater.arn
  timeout       = 60
  memory_size   = 512

  filename         = data.archive_file.placeholder.output_path
  source_code_hash = data.archive_file.placeholder.output_base64sha256

  environment {
    variables = {
      EVENTBRIDGE_BUS_NAME    = local.eventbridge_bus_name
      TABLE_NAME              = aws_dynamodb_table.knowledge_gap_tracker.name
      SOURCE_DOCUMENTS_BUCKET = aws_s3_bucket.kb_source_documents.id
      RUNBOOKS_BUCKET         = aws_s3_bucket.runbooks.id
      ENVIRONMENT             = var.environment
    }
  }

  tags = {
    Name = "${var.project_name}-knowledge-base-kb-updater"
  }
}
