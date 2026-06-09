# =============================================================================
# Lambda — DLQ Monitor + Audit Archival
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

# --- DLQ Monitor Lambda ---

resource "aws_lambda_function" "dlq_monitor" {
  function_name = "${var.project_name}-dlq-monitor"
  runtime       = "nodejs20.x"
  handler       = "index.handler"
  role          = aws_iam_role.dlq_monitor.arn
  timeout       = 30
  memory_size   = 256

  filename         = data.archive_file.placeholder.output_path
  source_code_hash = data.archive_file.placeholder.output_base64sha256

  environment {
    variables = {
      EVENTBRIDGE_BUS_NAME = local.eventbridge_bus_name
      SNS_TOPIC_ARN        = aws_sns_topic.platform_alarms.arn
      ENVIRONMENT          = var.environment
    }
  }

  tracing_config {
    mode = "Active"
  }

  tags = {
    Name = "${var.project_name}-dlq-monitor"
  }
}

resource "aws_iam_role" "dlq_monitor" {
  name               = "${var.project_name}-dlq-monitor-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json

  tags = {
    Name = "${var.project_name}-dlq-monitor-role"
  }
}

resource "aws_iam_role_policy_attachment" "dlq_monitor_observability" {
  role       = aws_iam_role.dlq_monitor.name
  policy_arn = local.lambda_observability_policy_arn
}

resource "aws_iam_role_policy" "dlq_monitor_sqs" {
  name = "${var.project_name}-dlq-monitor-sqs"
  role = aws_iam_role.dlq_monitor.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes"]
        Resource = "arn:aws:sqs:${var.aws_region}:*:${var.project_name}-*-dlq"
      },
      {
        Effect   = "Allow"
        Action   = ["sns:Publish"]
        Resource = [aws_sns_topic.platform_alarms.arn]
      }
    ]
  })
}

# --- Audit Archival Lambda (DynamoDB Streams trigger) ---

resource "aws_lambda_function" "audit_archival" {
  function_name = "${var.project_name}-audit-archival"
  runtime       = "nodejs20.x"
  handler       = "index.handler"
  role          = aws_iam_role.audit_archival.arn
  timeout       = 60
  memory_size   = 256

  filename         = data.archive_file.placeholder.output_path
  source_code_hash = data.archive_file.placeholder.output_base64sha256

  environment {
    variables = {
      ARCHIVAL_BUCKET = aws_s3_bucket.platform_storage.id
      ENVIRONMENT     = var.environment
    }
  }

  tracing_config {
    mode = "Active"
  }

  tags = {
    Name = "${var.project_name}-audit-archival"
  }
}

resource "aws_iam_role" "audit_archival" {
  name               = "${var.project_name}-audit-archival-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json

  tags = {
    Name = "${var.project_name}-audit-archival-role"
  }
}

resource "aws_iam_role_policy_attachment" "audit_archival_observability" {
  role       = aws_iam_role.audit_archival.name
  policy_arn = local.lambda_observability_policy_arn
}

resource "aws_iam_role_policy" "audit_archival_access" {
  name = "${var.project_name}-audit-archival-access"
  role = aws_iam_role.audit_archival.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetRecords",
          "dynamodb:GetShardIterator",
          "dynamodb:DescribeStream",
          "dynamodb:ListStreams"
        ]
        Resource = "${aws_dynamodb_table.audit_trail.arn}/stream/*"
      },
      {
        Effect   = "Allow"
        Action   = ["s3:PutObject"]
        Resource = "${aws_s3_bucket.platform_storage.arn}/audit/*"
      }
    ]
  })
}

# DynamoDB Streams → Lambda event source mapping
resource "aws_lambda_event_source_mapping" "audit_archival_stream" {
  event_source_arn  = aws_dynamodb_table.audit_trail.stream_arn
  function_name     = aws_lambda_function.audit_archival.arn
  starting_position = "LATEST"
  batch_size        = 100

  filter_criteria {
    filter {
      pattern = jsonencode({ eventName = ["REMOVE"] })
    }
  }
}

# --- Placeholder Lambda code (replaced at deploy time) ---

data "archive_file" "placeholder" {
  type        = "zip"
  output_path = "${path.module}/placeholder.zip"

  source {
    content  = "exports.handler = async () => ({ statusCode: 200 });"
    filename = "index.js"
  }
}
