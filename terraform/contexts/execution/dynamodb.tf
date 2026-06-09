# =============================================================================
# DynamoDB — Execution State Table
# =============================================================================

resource "aws_dynamodb_table" "execution_state" {
  name         = "${var.project_name}-execution-state"
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
    name = "planId"
    type = "S"
  }

  # GSI: Query by planId
  global_secondary_index {
    name            = "planId-index"
    hash_key        = "planId"
    projection_type = "ALL"
  }

  deletion_protection_enabled = false

  tags = {
    Name = "${var.project_name}-execution-state"
  }
}
