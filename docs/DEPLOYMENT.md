# ForgeAdmin Deployment Runbook

## Overview

This document covers the step-by-step process for deploying ForgeAdmin to a fresh AWS account. It follows the Production Maturity Roadmap phases.

## Prerequisites

- [ ] AWS CLI v2 installed and configured (`aws sts get-caller-identity` works)
- [ ] Terraform >= 1.6 installed (`terraform version`)
- [ ] pnpm >= 9.x installed (`pnpm --version`)
- [ ] Node.js >= 20.x installed (`node --version`)
- [ ] GitHub repository access with push to main
- [ ] AWS account with permissions for: Lambda, EventBridge, DynamoDB, S3, Cognito, API Gateway, Step Functions, CloudWatch, X-Ray, SNS, SES, VPC, Bedrock, CloudFront, Secrets Manager

## Phase 1: Foundation (Days 1-3)

### 1.1 Bootstrap State Backend

```bash
./scripts/bootstrap-state.sh
```

This creates the S3 bucket and DynamoDB table for Terraform state. One-time operation.

### 1.2 Deploy Foundation

```bash
cd terraform/foundation
terraform init
terraform plan -var-file=../environments/dev.tfvars
terraform apply -var-file=../environments/dev.tfvars
```

Verify: SSM parameters are created for EventBridge bus ARN, VPC ID, Cognito pool ID.

### 1.3 Deploy Platform Context

```bash
cd terraform/contexts/platform
terraform init
terraform apply -var-file=../../environments/dev.tfvars
```

### 1.4 Deploy Dashboard Context

```bash
cd terraform/contexts/dashboard
terraform init
terraform apply -var-file=../../environments/dev.tfvars
```

### 1.5 Create Team Accounts

```bash
# Get the User Pool ID from SSM or terraform output
POOL_ID=$(aws ssm get-parameter --name /forgeadmin/dev/cognito-user-pool-id --query Parameter.Value --output text)

# Create team leads
./scripts/add-cognito-users.sh "$POOL_ID" matt.rogers@dot.ohio.gov team_lead
./scripts/add-cognito-users.sh "$POOL_ID" second.lead@dot.ohio.gov team_lead

# Create team members
./scripts/add-cognito-users.sh "$POOL_ID" member.one@dot.ohio.gov team_member
./scripts/add-cognito-users.sh "$POOL_ID" member.two@dot.ohio.gov team_member
```

### 1.6 Update Cognito Callback URLs

After dashboard deploys, get the CloudFront domain:
```bash
CF_DOMAIN=$(aws ssm get-parameter --name /forgeadmin/dev/cloudfront-domain --query Parameter.Value --output text)
```

Update `terraform/environments/dev.tfvars`:
```hcl
cognito_callback_urls = ["https://${CF_DOMAIN}/callback"]
cognito_logout_urls   = ["https://${CF_DOMAIN}"]
```

Re-apply foundation:
```bash
cd terraform/foundation
terraform apply -var-file=../environments/dev.tfvars
```

### 1.7 Deploy Frontend

```bash
./scripts/deploy-frontend.sh dev
```

### 1.8 Verify

```bash
./scripts/verify-deployment.sh dev
```

## Phase 2: Brain Online (Week 2-4)

### 2.1 Deploy Remaining Contexts

```bash
./terraform/scripts/deploy-all.sh dev
```

Or individually:
```bash
cd terraform/contexts/ingestion && terraform init && terraform apply -var-file=../../environments/dev.tfvars
cd terraform/contexts/orchestration && terraform init && terraform apply -var-file=../../environments/dev.tfvars
cd terraform/contexts/knowledge-base && terraform init && terraform apply -var-file=../../environments/dev.tfvars
cd terraform/contexts/communication && terraform init && terraform apply -var-file=../../environments/dev.tfvars
cd terraform/contexts/correlation && terraform init && terraform apply -var-file=../../environments/dev.tfvars
```

### 2.2 Request Bedrock Model Access

1. AWS Console → Amazon Bedrock → Model access
2. Request access to: Claude 3 Sonnet (or latest), Titan Embeddings V2
3. Wait for approval (usually < 24 hours)

### 2.3 Seed Knowledge Base

1. Add runbook .md files to `seed-runbooks/` (see seed-runbooks/README.md for format)
2. Run:
```bash
pnpm tsx scripts/seed-knowledge-base.ts dev
```

### 2.4 Configure ServiceNow Integration

```bash
# Store ServiceNow credentials in Secrets Manager
aws secretsmanager create-secret \
  --name forgeadmin/ingestion/servicenow-credentials \
  --secret-string '{"username":"svc_forgeadmin","password":"REDACTED"}' \
  --region us-east-2

# Set SSM parameters
./scripts/configure-ssm-params.sh /forgeadmin/ingestion/servicenow-url "https://odot.service-now.com/api/now/table/incident"
./scripts/configure-ssm-params.sh /forgeadmin/ingestion/servicenow-secret-arn "arn:aws:secretsmanager:us-east-2:ACCOUNT:secret:forgeadmin/ingestion/servicenow-credentials"
./scripts/configure-ssm-params.sh /forgeadmin/ingestion/servicenow-poll-interval "60"
./scripts/configure-ssm-params.sh /forgeadmin/ingestion/servicenow-filter "assignment_group=Windows Server Team"
```

### 2.5 Configure Teams/Slack Notifications

```bash
./scripts/configure-ssm-params.sh /forgeadmin/communication/webhook-url "https://hooks.slack.com/services/..." SecureString
./scripts/configure-ssm-params.sh /forgeadmin/communication/webhook-type "slack"
```

### 2.6 Enable Shadow Mode

Via the Dashboard UI:
1. Log in as team_lead
2. Navigate to Modules
3. Set each module to "Shadow" state

### 2.7 Verify Shadow Pipeline

Wait for the next ServiceNow poll cycle (60 seconds), then check:
- Dashboard shows ingested work items
- Audit trail shows triage/research/planning events
- Morning digest arrives next day at 7:00 AM ET

## Troubleshooting

### Terraform init fails with "backend configuration changed"
Run: `terraform init -reconfigure`

### Lambda invocation errors
Check CloudWatch Logs: `/aws/lambda/forgeadmin-{env}-{context}-{handler}`

### EventBridge events not arriving
Check: EventBridge rules match the event pattern. Use CloudWatch Metrics to see if rules are triggering.

### Cognito login fails
Verify callback URLs match the CloudFront domain exactly (including https://).

### Bedrock InvokeModel AccessDenied
Model access may not be approved yet. Check AWS Console → Bedrock → Model access.
