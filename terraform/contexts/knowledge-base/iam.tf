# =============================================================================
# IAM — Knowledge Base Lambda Roles
# =============================================================================

# --- KB Query Handler Role ---

resource "aws_iam_role" "kb_query_handler" {
  name               = "${var.project_name}-knowledge-base-kb-query-handler-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json

  tags = {
    Name = "${var.project_name}-knowledge-base-kb-query-handler-role"
  }
}

resource "aws_iam_role_policy_attachment" "kb_query_handler_observability" {
  role       = aws_iam_role.kb_query_handler.name
  policy_arn = local.lambda_observability_policy_arn
}

resource "aws_iam_role_policy" "kb_query_handler_access" {
  name = "${var.project_name}-knowledge-base-kb-query-handler-access"
  role = aws_iam_role.kb_query_handler.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.kb_source_documents.arn,
          "${aws_s3_bucket.kb_source_documents.arn}/*",
          aws_s3_bucket.runbooks.arn,
          "${aws_s3_bucket.runbooks.arn}/*"
        ]
      },
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
          aws_dynamodb_table.knowledge_gap_tracker.arn,
          "${aws_dynamodb_table.knowledge_gap_tracker.arn}/index/*"
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

# --- Runbook Generator Role ---

resource "aws_iam_role" "runbook_generator" {
  name               = "${var.project_name}-knowledge-base-runbook-generator-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json

  tags = {
    Name = "${var.project_name}-knowledge-base-runbook-generator-role"
  }
}

resource "aws_iam_role_policy_attachment" "runbook_generator_observability" {
  role       = aws_iam_role.runbook_generator.name
  policy_arn = local.lambda_observability_policy_arn
}

resource "aws_iam_role_policy" "runbook_generator_access" {
  name = "${var.project_name}-knowledge-base-runbook-generator-access"
  role = aws_iam_role.runbook_generator.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.kb_source_documents.arn,
          "${aws_s3_bucket.kb_source_documents.arn}/*",
          aws_s3_bucket.runbooks.arn,
          "${aws_s3_bucket.runbooks.arn}/*"
        ]
      },
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
          aws_dynamodb_table.knowledge_gap_tracker.arn,
          "${aws_dynamodb_table.knowledge_gap_tracker.arn}/index/*"
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

# --- KB Updater Role ---

resource "aws_iam_role" "kb_updater" {
  name               = "${var.project_name}-knowledge-base-kb-updater-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json

  tags = {
    Name = "${var.project_name}-knowledge-base-kb-updater-role"
  }
}

resource "aws_iam_role_policy_attachment" "kb_updater_observability" {
  role       = aws_iam_role.kb_updater.name
  policy_arn = local.lambda_observability_policy_arn
}

resource "aws_iam_role_policy" "kb_updater_access" {
  name = "${var.project_name}-knowledge-base-kb-updater-access"
  role = aws_iam_role.kb_updater.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.kb_source_documents.arn,
          "${aws_s3_bucket.kb_source_documents.arn}/*",
          aws_s3_bucket.runbooks.arn,
          "${aws_s3_bucket.runbooks.arn}/*"
        ]
      },
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
          aws_dynamodb_table.knowledge_gap_tracker.arn,
          "${aws_dynamodb_table.knowledge_gap_tracker.arn}/index/*"
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
