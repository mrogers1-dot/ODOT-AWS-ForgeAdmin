# =============================================================================
# DynamoDB — Orchestration Table (Single-Table Design)
# =============================================================================

resource "aws_dynamodb_table" "orchestration" {
  name         = "${var.project_name}-orchestration"
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
    name = "status"
    type = "S"
  }

  attribute {
    name = "createdAt"
    type = "S"
  }

  attribute {
    name = "category"
    type = "S"
  }

  attribute {
    name = "riskLevel"
    type = "S"
  }

  # GSI: Query by status + createdAt
  global_secondary_index {
    name            = "status-createdAt-index"
    hash_key        = "status"
    range_key       = "createdAt"
    projection_type = "ALL"
  }

  # GSI: Query by category + riskLevel
  global_secondary_index {
    name            = "category-riskLevel-index"
    hash_key        = "category"
    range_key       = "riskLevel"
    projection_type = "ALL"
  }

  # DynamoDB Streams for downstream processing
  stream_enabled   = true
  stream_view_type = "NEW_AND_OLD_IMAGES"

  point_in_time_recovery {
    enabled = true
  }

  deletion_protection_enabled = false

  tags = {
    Name = "${var.project_name}-orchestration"
  }
}
