terraform {
  backend "s3" {
    bucket         = "forgeadmin-terraform-state"
    key            = "forgeadmin/platform/terraform.tfstate"
    region         = "us-east-2"
    dynamodb_table = "forgeadmin-terraform-locks"
    encrypt        = true
  }
}
