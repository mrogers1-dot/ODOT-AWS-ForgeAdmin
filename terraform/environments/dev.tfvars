aws_region       = "us-east-2"
environment      = "dev"
project_name     = "forgeadmin"
state_bucket     = "forgeadmin-terraform-state"
state_lock_table = "forgeadmin-terraform-locks"

vpc_cidr             = "10.0.0.0/16"
availability_zones   = ["us-east-2a", "us-east-2b"]
private_subnet_cidrs = ["10.0.1.0/24", "10.0.2.0/24"]
public_subnet_cidrs  = ["10.0.101.0/24", "10.0.102.0/24"]

# UPDATE AFTER DASHBOARD DEPLOY: Replace localhost with CloudFront domain
# Example: ["https://d1234abcdef.cloudfront.net/callback"]
cognito_callback_urls = ["http://localhost:5173/callback"]
cognito_logout_urls   = ["http://localhost:5173"]
