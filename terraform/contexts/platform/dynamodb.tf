# =============================================================================
# DynamoDB — Audit Trail Table (Single-Table Design)
# =============================================================================

resource "aws_dynamodb_table" "audit_trail" {
  name         = "${var.project_name}-audit-trail"
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
    name = "actor"
    type = "S"
  }

  attribute {
    name = "timestamp"
    type = "S"
  }

  attribute {
    name = "context"
    type = "S"
  }

  attribute {
    name = "action"
    type = "S"
  }

  # GSI: Query by actor + timestamp
  global_secondary_index {
    name            = "actor-timestamp-index"
    hash_key        = "actor"
    range_key       = "timestamp"
    projection_type = "ALL"
  }

  # GSI: Query by context + action
  global_secondary_index {
    name            = "context-action-index"
    hash_key        = "context"
    range_key       = "action"
    projection_type = "ALL"
  }

  # DynamoDB Streams for archival trigger
  stream_enabled   = true
  stream_view_type = "OLD_IMAGE"

  # TTL for 90-day lifecycle (items archived to S3 before expiry)
  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  point_in_time_recovery {
    enabled = true
  }

  deletion_protection_enabled = false

  tags = {
    Name = "${var.project_name}-audit-trail"
  }
}
