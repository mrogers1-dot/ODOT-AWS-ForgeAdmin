# =============================================================================
# DynamoDB — Knowledge Gap Tracker Table
# =============================================================================

resource "aws_dynamodb_table" "knowledge_gap_tracker" {
  name         = "${var.project_name}-knowledge-base-knowledge-gap-tracker"
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
    Name = "${var.project_name}-knowledge-base-knowledge-gap-tracker"
  }
}
