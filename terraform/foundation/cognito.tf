# =============================================================================
# Cognito — User Pool with team_lead and team_member Roles
# =============================================================================

resource "aws_cognito_user_pool" "main" {
  name = "${var.project_name}-users"

  password_policy {
    minimum_length                   = 12
    require_lowercase                = true
    require_uppercase                = true
    require_numbers                  = true
    require_symbols                  = true
    temporary_password_validity_days = 7
  }

  mfa_configuration = "OPTIONAL"

  software_token_mfa_configuration {
    enabled = true
  }

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  schema {
    name                     = "email"
    attribute_data_type      = "String"
    required                 = true
    mutable                  = true
    developer_only_attribute = false

    string_attribute_constraints {
      min_length = 5
      max_length = 256
    }
  }

  auto_verified_attributes = ["email"]

  tags = {
    Name = "${var.project_name}-user-pool"
  }
}

# --- User Pool Groups (RBAC) ---

resource "aws_cognito_user_group" "team_lead" {
  name         = "team_lead"
  user_pool_id = aws_cognito_user_pool.main.id
  description  = "Full access — approve plans, modify config, manage modules"
  precedence   = 1
}

resource "aws_cognito_user_group" "team_member" {
  name         = "team_member"
  user_pool_id = aws_cognito_user_pool.main.id
  description  = "Read-only config, can approve plans assigned to them"
  precedence   = 10
}

# --- User Pool Client (Dashboard SPA) ---

resource "aws_cognito_user_pool_client" "dashboard" {
  name         = "${var.project_name}-dashboard"
  user_pool_id = aws_cognito_user_pool.main.id

  allowed_oauth_flows                  = ["code"]
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_scopes                 = ["email", "openid", "profile"]
  supported_identity_providers         = ["COGNITO"]

  callback_urls = var.cognito_callback_urls
  logout_urls   = var.cognito_logout_urls

  access_token_validity  = 1
  id_token_validity      = 1
  refresh_token_validity = 30

  token_validity_units {
    access_token  = "hours"
    id_token      = "hours"
    refresh_token = "days"
  }

  prevent_user_existence_errors = "ENABLED"
  explicit_auth_flows = [
    "ALLOW_REFRESH_TOKEN_AUTH",
    "ALLOW_USER_SRP_AUTH",
  ]

  generate_secret = false
}

# --- User Pool Domain ---

resource "aws_cognito_user_pool_domain" "main" {
  domain       = "${var.project_name}-${var.environment}"
  user_pool_id = aws_cognito_user_pool.main.id
}
