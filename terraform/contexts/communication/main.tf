terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "ForgeAdmin"
      Environment = var.environment
      ManagedBy   = "Terraform"
      Context     = "communication"
    }
  }
}

# =============================================================================
# SSM Parameter Lookups — Foundation Outputs
# =============================================================================

data "aws_ssm_parameter" "eventbridge_bus_arn" {
  name = "/${var.project_name}/foundation/eventbridge-bus-arn"
}

data "aws_ssm_parameter" "eventbridge_bus_name" {
  name = "/${var.project_name}/foundation/eventbridge-bus-name"
}

data "aws_ssm_parameter" "lambda_observability_policy_arn" {
  name = "/${var.project_name}/foundation/lambda-observability-policy-arn"
}

locals {
  eventbridge_bus_arn             = data.aws_ssm_parameter.eventbridge_bus_arn.value
  eventbridge_bus_name            = data.aws_ssm_parameter.eventbridge_bus_name.value
  lambda_observability_policy_arn = data.aws_ssm_parameter.lambda_observability_policy_arn.value
}

# =============================================================================
# Variables
# =============================================================================

variable "aws_region" {
  description = "AWS region for all resources"
  type        = string
  default     = "us-east-2"
}

variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "dev"
}

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
  default     = "forgeadmin"
}

variable "state_bucket" {
  description = "S3 bucket for Terraform state"
  type        = string
}

variable "state_lock_table" {
  description = "DynamoDB table for state locking"
  type        = string
}
