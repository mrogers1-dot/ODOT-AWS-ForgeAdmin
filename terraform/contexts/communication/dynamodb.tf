# =============================================================================
# DynamoDB — Notification State Table
# =============================================================================

resource "aws_dynamodb_table" "notification_state" {
  name         = "${var.project_name}-communication-notification-state"
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

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  deletion_protection_enabled = false

  tags = {
    Name = "${var.project_name}-communication-notification-state"
  }
}
