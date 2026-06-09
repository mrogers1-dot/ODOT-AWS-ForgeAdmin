# =============================================================================
# EventBridge — Custom Event Bus + Schema Registry
# =============================================================================

resource "aws_cloudwatch_event_bus" "main" {
  name = "${var.project_name}-events"

  tags = {
    Name = "${var.project_name}-events"
  }
}

resource "aws_schemas_registry" "main" {
  name        = "${var.project_name}-registry"
  description = "Schema registry for ForgeAdmin event contracts"
}

# Archive for event replay and debugging
resource "aws_cloudwatch_event_archive" "main" {
  name             = "${var.project_name}-archive"
  event_source_arn = aws_cloudwatch_event_bus.main.arn
  retention_days   = 90
}

# DLQ for undeliverable events
resource "aws_sqs_queue" "eventbridge_dlq" {
  name                      = "${var.project_name}-eventbridge-dlq"
  message_retention_seconds = 1209600 # 14 days

  tags = {
    Name = "${var.project_name}-eventbridge-dlq"
  }
}

resource "aws_sqs_queue_policy" "eventbridge_dlq" {
  queue_url = aws_sqs_queue.eventbridge_dlq.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Principal = { Service = "events.amazonaws.com" }
        Action    = "sqs:SendMessage"
        Resource  = aws_sqs_queue.eventbridge_dlq.arn
        Condition = {
          ArnEquals = {
            "aws:SourceArn" = aws_cloudwatch_event_bus.main.arn
          }
        }
      }
    ]
  })
}
