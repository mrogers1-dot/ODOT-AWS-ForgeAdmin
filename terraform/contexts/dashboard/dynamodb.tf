# =============================================================================
# DynamoDB — Dashboard Table (Modules + Approvals)
# =============================================================================

resource "aws_dynamodb_table" "dashboard" {
  name         = "${var.project_name}-dashboard"
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
    name = "state"
    type = "S"
  }

  attribute {
    name = "approvalStatus"
    type = "S"
  }

  # GSI: Query by state
  global_secondary_index {
    name            = "state-index"
    hash_key        = "state"
    range_key       = "SK"
    projection_type = "ALL"
  }

  # GSI: Query by approval status
  global_secondary_index {
    name            = "approval-status-index"
    hash_key        = "approvalStatus"
    range_key       = "SK"
    projection_type = "ALL"
  }

  deletion_protection_enabled = false

  tags = {
    Name = "${var.project_name}-dashboard"
  }
}
