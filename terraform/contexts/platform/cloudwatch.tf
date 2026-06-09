# =============================================================================
# CloudWatch — Dashboards and Alarms
# =============================================================================

# --- Platform Overview Dashboard ---

resource "aws_cloudwatch_dashboard" "platform_overview" {
  dashboard_name = "${var.project_name}-platform-overview"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6
        properties = {
          title   = "DLQ Message Depth"
          region  = var.aws_region
          metrics = [
            ["AWS/SQS", "ApproximateNumberOfMessagesVisible", "QueueName", "${var.project_name}-eventbridge-dlq"]
          ]
          period = 300
          stat   = "Maximum"
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 0
        width  = 12
        height = 6
        properties = {
          title   = "Lambda Errors (All Contexts)"
          region  = var.aws_region
          metrics = [
            ["AWS/Lambda", "Errors", "FunctionName", "${var.project_name}-dlq-monitor"],
            ["AWS/Lambda", "Errors", "FunctionName", "${var.project_name}-audit-archival"]
          ]
          period = 300
          stat   = "Sum"
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 24
        height = 6
        properties = {
          title   = "Audit Trail Write Latency"
          region  = var.aws_region
          metrics = [
            ["AWS/DynamoDB", "SuccessfulRequestLatency", "TableName", "${var.project_name}-audit-trail", "Operation", "PutItem"]
          ]
          period = 60
          stat   = "Average"
        }
      }
    ]
  })
}

# --- DLQ Depth Alarm (fires if any message lands in DLQ) ---

resource "aws_cloudwatch_metric_alarm" "dlq_depth" {
  alarm_name          = "${var.project_name}-dlq-depth"
  alarm_description   = "Fires when messages appear in the EventBridge DLQ"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 60
  statistic           = "Maximum"
  threshold           = 0

  dimensions = {
    QueueName = "${var.project_name}-eventbridge-dlq"
  }

  alarm_actions = [aws_sns_topic.platform_alarms.arn]
  ok_actions    = [aws_sns_topic.platform_alarms.arn]

  tags = {
    Name = "${var.project_name}-dlq-depth-alarm"
  }
}

# --- Lambda Error Rate Alarm ---

resource "aws_cloudwatch_metric_alarm" "lambda_errors" {
  alarm_name          = "${var.project_name}-lambda-error-rate"
  alarm_description   = "Fires when platform Lambda error rate exceeds threshold"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = 5

  dimensions = {
    FunctionName = aws_lambda_function.dlq_monitor.function_name
  }

  alarm_actions = [aws_sns_topic.platform_alarms.arn]

  tags = {
    Name = "${var.project_name}-lambda-error-alarm"
  }
}
