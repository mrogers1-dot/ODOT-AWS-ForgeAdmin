# =============================================================================
# DynamoDB — Work Items Table (Single-Table Design)
# =============================================================================

resource "aws_dynamodb_table" "work_items" {
  name         = "${var.project_name}-ingestion-work-items"
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
    name = "sourceSystem"
    type = "S"
  }

  attribute {
    name = "originalId"
    type = "S"
  }

  # GSI: Query by sourceSystem + originalId
  global_secondary_index {
    name            = "sourceSystem-originalId-index"
    hash_key        = "sourceSystem"
    range_key       = "originalId"
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
    Name = "${var.project_name}-ingestion-work-items"
  }
}
