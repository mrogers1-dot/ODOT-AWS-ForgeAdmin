# =============================================================================
# SNS — Alarm Notification Topics
# =============================================================================

resource "aws_sns_topic" "platform_alarms" {
  name = "${var.project_name}-platform-alarms"

  tags = {
    Name = "${var.project_name}-platform-alarms"
  }
}

resource "aws_sns_topic_subscription" "alarm_email" {
  count = var.alarm_email != "" ? 1 : 0

  topic_arn = aws_sns_topic.platform_alarms.arn
  protocol  = "email"
  endpoint  = var.alarm_email
}
