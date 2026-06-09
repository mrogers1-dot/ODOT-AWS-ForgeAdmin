# =============================================================================
# IAM — Dashboard Lambda Roles
# =============================================================================

# --- API Handler Role ---

resource "aws_iam_role" "api_handler" {
  name               = "${var.project_name}-dashboard-api-handler-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json

  tags = {
    Name = "${var.project_name}-dashboard-api-handler-role"
  }
}

resource "aws_iam_role_policy_attachment" "api_handler_observability" {
  role       = aws_iam_role.api_handler.name
  policy_arn = local.lambda_observability_policy_arn
}

resource "aws_iam_role_policy" "api_handler_access" {
  name = "${var.project_name}-dashboard-api-handler-access"
  role = aws_iam_role.api_handler.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan"
        ]
        Resource = [
          aws_dynamodb_table.dashboard.arn,
          "${aws_dynamodb_table.dashboard.arn}/index/*"
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

# --- WebSocket Connect Role ---

resource "aws_iam_role" "websocket_connect" {
  name               = "${var.project_name}-dashboard-websocket-connect-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json

  tags = {
    Name = "${var.project_name}-dashboard-websocket-connect-role"
  }
}

resource "aws_iam_role_policy_attachment" "websocket_connect_observability" {
  role       = aws_iam_role.websocket_connect.name
  policy_arn = local.lambda_observability_policy_arn
}

resource "aws_iam_role_policy" "websocket_connect_access" {
  name = "${var.project_name}-dashboard-websocket-connect-access"
  role = aws_iam_role.websocket_connect.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query"
        ]
        Resource = [
          aws_dynamodb_table.dashboard.arn,
          "${aws_dynamodb_table.dashboard.arn}/index/*"
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

# --- WebSocket Disconnect Role ---

resource "aws_iam_role" "websocket_disconnect" {
  name               = "${var.project_name}-dashboard-websocket-disconnect-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json

  tags = {
    Name = "${var.project_name}-dashboard-websocket-disconnect-role"
  }
}

resource "aws_iam_role_policy_attachment" "websocket_disconnect_observability" {
  role       = aws_iam_role.websocket_disconnect.name
  policy_arn = local.lambda_observability_policy_arn
}

resource "aws_iam_role_policy" "websocket_disconnect_access" {
  name = "${var.project_name}-dashboard-websocket-disconnect-access"
  role = aws_iam_role.websocket_disconnect.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query"
        ]
        Resource = [
          aws_dynamodb_table.dashboard.arn,
          "${aws_dynamodb_table.dashboard.arn}/index/*"
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
