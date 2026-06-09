# =============================================================================
# API Gateway — Execution REST API
# =============================================================================

resource "aws_api_gateway_rest_api" "execution_api" {
  name        = "${var.project_name}-execution-api"
  description = "REST API for ForgeAdmin execution callbacks"

  tags = {
    Name = "${var.project_name}-execution-api"
  }
}

resource "aws_api_gateway_resource" "callback" {
  rest_api_id = aws_api_gateway_rest_api.execution_api.id
  parent_id   = aws_api_gateway_rest_api.execution_api.root_resource_id
  path_part   = "callback"
}

resource "aws_api_gateway_method" "callback_post" {
  rest_api_id   = aws_api_gateway_rest_api.execution_api.id
  resource_id   = aws_api_gateway_resource.callback.id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "callback_lambda" {
  rest_api_id             = aws_api_gateway_rest_api.execution_api.id
  resource_id             = aws_api_gateway_resource.callback.id
  http_method             = aws_api_gateway_method.callback_post.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.callback_handler.invoke_arn
}

resource "aws_lambda_permission" "callback_handler_apigw" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.callback_handler.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.execution_api.execution_arn}/*/*"
}
