# =============================================================================
# SQS — Communication Queues
# =============================================================================

resource "aws_sqs_queue" "communication_dlq" {
  name                      = "${var.project_name}-communication-dlq"
  message_retention_seconds = 1209600 # 14 days

  tags = {
    Name = "${var.project_name}-communication-dlq"
  }
}

resource "aws_sqs_queue" "communication" {
  name                       = "${var.project_name}-communication-queue"
  visibility_timeout_seconds = 60

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.communication_dlq.arn
    maxReceiveCount     = 3
  })

  tags = {
    Name = "${var.project_name}-communication-queue"
  }
}
