# =============================================================================
# DynamoDB — Correlation Tables
# =============================================================================

# --- Correlation Sessions Table ---

resource "aws_dynamodb_table" "correlation_sessions" {
  name         = "${var.project_name}-correlation-sessions"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "PK"
  range_key    = "SK"

  attribute {
    name = "PK"
    type = "S"
  }

  attribute {
    name = "SK"
    type = "S"
  }

  attribute {
    name = "ruleId"
    type = "S"
  }

  attribute {
    name = "matchKey"
    type = "S"
  }

  attribute {
    name = "status"
    type = "S"
  }

  # GSI: Query by ruleId + matchKey
  global_secondary_index {
    name            = "ruleId-matchKey-index"
    hash_key        = "ruleId"
    range_key       = "matchKey"
    projection_type = "ALL"
  }

  # GSI: Query by status
  global_secondary_index {
    name            = "status-index"
    hash_key        = "status"
    range_key       = "SK"
    projection_type = "ALL"
  }

  point_in_time_recovery {
    enabled = true
  }

  deletion_protection_enabled = false

  tags = {
    Name = "${var.project_name}-correlation-sessions"
  }
}

# --- Correlation Rules Table ---

resource "aws_dynamodb_table" "correlation_rules" {
  name         = "${var.project_name}-correlation-rules"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "PK"
  range_key    = "SK"

  attribute {
    name = "PK"
    type = "S"
  }

  attribute {
    name = "SK"
    type = "S"
  }

  deletion_protection_enabled = false

  tags = {
    Name = "${var.project_name}-correlation-rules"
  }
}
