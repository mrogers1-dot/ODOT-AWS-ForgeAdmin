# =============================================================================
# SQS — Execution Queues
# =============================================================================

resource "aws_sqs_queue" "execution_dlq" {
  name                      = "${var.project_name}-execution-dlq"
  message_retention_seconds = 1209600 # 14 days

  tags = {
    Name = "${var.project_name}-execution-dlq"
  }
}

resource "aws_sqs_queue" "execution" {
  name                       = "${var.project_name}-execution-queue"
  visibility_timeout_seconds = 900

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.execution_dlq.arn
    maxReceiveCount     = 3
  })

  tags = {
    Name = "${var.project_name}-execution-queue"
  }
}
