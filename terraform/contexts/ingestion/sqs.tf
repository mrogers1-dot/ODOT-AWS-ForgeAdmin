# =============================================================================
# SQS — Ingestion Dead Letter Queue
# =============================================================================

resource "aws_sqs_queue" "ingestion_dlq" {
  name                      = "${var.project_name}-ingestion-dlq"
  message_retention_seconds = 1209600 # 14 days

  tags = {
    Name = "${var.project_name}-ingestion-dlq"
  }
}
