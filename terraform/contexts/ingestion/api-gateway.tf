# =============================================================================
# API Gateway — Ingestion REST API
# =============================================================================

resource "aws_api_gateway_rest_api" "ingestion_api" {
  name        = "${var.project_name}-ingestion-api"
  description = "REST API for ForgeAdmin ingestion webhooks"

  tags = {
    Name = "${var.project_name}-ingestion-api"
  }
}

resource "aws_api_gateway_resource" "webhook" {
  rest_api_id = aws_api_gateway_rest_api.ingestion_api.id
  parent_id   = aws_api_gateway_rest_api.ingestion_api.root_resource_id
  path_part   = "webhook"
}

resource "aws_api_gateway_method" "webhook_post" {
  rest_api_id   = aws_api_gateway_rest_api.ingestion_api.id
  resource_id   = aws_api_gateway_resource.webhook.id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "webhook_lambda" {
  rest_api_id             = aws_api_gateway_rest_api.ingestion_api.id
  resource_id             = aws_api_gateway_resource.webhook.id
  http_method             = aws_api_gateway_method.webhook_post.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.fortisiem_webhook.invoke_arn
}

resource "aws_lambda_permission" "fortisiem_webhook_apigw" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.fortisiem_webhook.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.ingestion_api.execution_arn}/*/*"
}
