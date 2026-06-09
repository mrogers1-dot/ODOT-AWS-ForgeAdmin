# =============================================================================
# IAM — Orchestration Roles
# =============================================================================

# --- Step Functions Execution Role ---

data "aws_iam_policy_document" "sfn_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["states.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "step_functions" {
  name               = "${var.project_name}-orchestration-sfn-role"
  assume_role_policy = data.aws_iam_policy_document.sfn_assume.json

  tags = {
    Name = "${var.project_name}-orchestration-sfn-role"
  }
}

resource "aws_iam_role_policy" "step_functions_access" {
  name = "${var.project_name}-orchestration-sfn-access"
  role = aws_iam_role.step_functions.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["states:StartExecution"]
        Resource = [aws_sfn_state_machine.orchestration.arn]
      },
      {
        Effect = "Allow"
        Action = ["lambda:InvokeFunction"]
        Resource = [
          aws_lambda_function.triage_agent.arn,
          aws_lambda_function.research_agent.arn,
          aws_lambda_function.planning_agent.arn,
          aws_lambda_function.verification_agent.arn,
          aws_lambda_function.supervisor_agent.arn,
        ]
      }
    ]
  })
}

# --- Triage Agent Role ---

resource "aws_iam_role" "triage_agent" {
  name               = "${var.project_name}-orchestration-triage-agent-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json

  tags = {
    Name = "${var.project_name}-orchestration-triage-agent-role"
  }
}

resource "aws_iam_role_policy_attachment" "triage_agent_observability" {
  role       = aws_iam_role.triage_agent.name
  policy_arn = local.lambda_observability_policy_arn
}

resource "aws_iam_role_policy" "triage_agent_access" {
  name = "${var.project_name}-orchestration-triage-agent-access"
  role = aws_iam_role.triage_agent.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
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
          aws_dynamodb_table.orchestration.arn,
          "${aws_dynamodb_table.orchestration.arn}/index/*"
        ]
      },
      {
        Effect   = "Allow"
        Action   = ["events:PutEvents"]
        Resource = [local.eventbridge_bus_arn]
      },
      {
        Effect   = "Allow"
        Action   = ["bedrock:InvokeModel"]
        Resource = ["*"]
      }
    ]
  })
}

# --- Research Agent Role ---

resource "aws_iam_role" "research_agent" {
  name               = "${var.project_name}-orchestration-research-agent-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json

  tags = {
    Name = "${var.project_name}-orchestration-research-agent-role"
  }
}

resource "aws_iam_role_policy_attachment" "research_agent_observability" {
  role       = aws_iam_role.research_agent.name
  policy_arn = local.lambda_observability_policy_arn
}

resource "aws_iam_role_policy" "research_agent_access" {
  name = "${var.project_name}-orchestration-research-agent-access"
  role = aws_iam_role.research_agent.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
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
          aws_dynamodb_table.orchestration.arn,
          "${aws_dynamodb_table.orchestration.arn}/index/*"
        ]
      },
      {
        Effect   = "Allow"
        Action   = ["events:PutEvents"]
        Resource = [local.eventbridge_bus_arn]
      },
      {
        Effect   = "Allow"
        Action   = ["bedrock:InvokeModel"]
        Resource = ["*"]
      }
    ]
  })
}

# --- Planning Agent Role ---

resource "aws_iam_role" "planning_agent" {
  name               = "${var.project_name}-orchestration-planning-agent-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json

  tags = {
    Name = "${var.project_name}-orchestration-planning-agent-role"
  }
}

resource "aws_iam_role_policy_attachment" "planning_agent_observability" {
  role       = aws_iam_role.planning_agent.name
  policy_arn = local.lambda_observability_policy_arn
}

resource "aws_iam_role_policy" "planning_agent_access" {
  name = "${var.project_name}-orchestration-planning-agent-access"
  role = aws_iam_role.planning_agent.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
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
          aws_dynamodb_table.orchestration.arn,
          "${aws_dynamodb_table.orchestration.arn}/index/*"
        ]
      },
      {
        Effect   = "Allow"
        Action   = ["events:PutEvents"]
        Resource = [local.eventbridge_bus_arn]
      },
      {
        Effect   = "Allow"
        Action   = ["bedrock:InvokeModel"]
        Resource = ["*"]
      }
    ]
  })
}

# --- Verification Agent Role ---

resource "aws_iam_role" "verification_agent" {
  name               = "${var.project_name}-orchestration-verification-agent-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json

  tags = {
    Name = "${var.project_name}-orchestration-verification-agent-role"
  }
}

resource "aws_iam_role_policy_attachment" "verification_agent_observability" {
  role       = aws_iam_role.verification_agent.name
  policy_arn = local.lambda_observability_policy_arn
}

resource "aws_iam_role_policy" "verification_agent_access" {
  name = "${var.project_name}-orchestration-verification-agent-access"
  role = aws_iam_role.verification_agent.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
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
          aws_dynamodb_table.orchestration.arn,
          "${aws_dynamodb_table.orchestration.arn}/index/*"
        ]
      },
      {
        Effect   = "Allow"
        Action   = ["events:PutEvents"]
        Resource = [local.eventbridge_bus_arn]
      },
      {
        Effect   = "Allow"
        Action   = ["bedrock:InvokeModel"]
        Resource = ["*"]
      }
    ]
  })
}

# --- Supervisor Agent Role ---

resource "aws_iam_role" "supervisor_agent" {
  name               = "${var.project_name}-orchestration-supervisor-agent-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json

  tags = {
    Name = "${var.project_name}-orchestration-supervisor-agent-role"
  }
}

resource "aws_iam_role_policy_attachment" "supervisor_agent_observability" {
  role       = aws_iam_role.supervisor_agent.name
  policy_arn = local.lambda_observability_policy_arn
}

resource "aws_iam_role_policy" "supervisor_agent_access" {
  name = "${var.project_name}-orchestration-supervisor-agent-access"
  role = aws_iam_role.supervisor_agent.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
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
          aws_dynamodb_table.orchestration.arn,
          "${aws_dynamodb_table.orchestration.arn}/index/*"
        ]
      },
      {
        Effect   = "Allow"
        Action   = ["events:PutEvents"]
        Resource = [local.eventbridge_bus_arn]
      },
      {
        Effect   = "Allow"
        Action   = ["bedrock:InvokeModel"]
        Resource = ["*"]
      }
    ]
  })
}
