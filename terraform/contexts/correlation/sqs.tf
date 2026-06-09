# =============================================================================
# SQS — Correlation Queues
# =============================================================================

resource "aws_sqs_queue" "correlation_dlq" {
  name                      = "${var.project_name}-correlation-dlq"
  message_retention_seconds = 1209600 # 14 days

  tags = {
    Name = "${var.project_name}-correlation-dlq"
  }
}

resource "aws_sqs_queue" "correlation_input_buffer" {
  name                       = "${var.project_name}-correlation-input-buffer"
  visibility_timeout_seconds = 60

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.correlation_dlq.arn
    maxReceiveCount     = 3
  })

  tags = {
    Name = "${var.project_name}-correlation-input-buffer"
  }
}
