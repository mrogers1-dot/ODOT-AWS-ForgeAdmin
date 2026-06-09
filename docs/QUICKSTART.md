# ForgeAdmin — Quick Start Guide

## Prerequisites

- **Node.js** >= 20.x
- **pnpm** >= 9.x
- **AWS CLI** v2 configured with appropriate credentials
- **Terraform** >= 1.6.x
- **AWS Account** with permissions for: Lambda, EventBridge, DynamoDB, S3, Cognito, API Gateway, Step Functions, CloudWatch, X-Ray, SNS, SES, VPC

## Initial Setup

### 1. Clone and install dependencies

```bash
git clone <repository-url>
cd DOT-ForgeAdmin
pnpm install
```

### 2. Verify TypeScript compiles

```bash
pnpm typecheck
```

### 3. Run unit tests

```bash
pnpm test:unit
```

### 4. Validate Terraform

```bash
cd terraform/foundation
terraform init
terraform validate

cd ../contexts/platform
terraform init
terraform validate
```

## Deployment

### Deploy everything (foundation first, then contexts in parallel)

```bash
./terraform/scripts/deploy-all.sh
```

### Deploy a single context

```bash
cd terraform/contexts/ingestion
terraform init
terraform plan -var-file=../../environments/dev.tfvars
terraform apply -var-file=../../environments/dev.tfvars
```

### Destroy a single context

```bash
./terraform/scripts/destroy-context.sh ingestion
```

### Destroy everything (contexts first, then foundation)

```bash
./terraform/scripts/destroy-all.sh
```

## Project Structure

```
DOT-ForgeAdmin/
├── contracts/
│   ├── api/          # OpenAPI specifications
│   └── events/       # JSON Schema event contracts
├── docs/
│   ├── adr/          # Architecture Decision Records
│   └── tasks/        # Implementation task groups
├── src/
│   ├── shared/       # Shared utilities (@forgeadmin/shared)
│   └── contexts/     # Bounded context implementations
├── terraform/
│   ├── foundation/   # Shared infra (EventBridge, VPC, Cognito)
│   ├── contexts/     # Per-context Terraform modules
│   ├── environments/ # Environment-specific variables
│   └── scripts/      # Deploy/destroy automation
└── scripts/          # Utility scripts (contract validation, etc.)
```

## Environment Variables

Create a `.env` file (see `.env.example`) or use AWS SSM Parameter Store:

| Parameter | Description |
|-----------|-------------|
| `EVENTBRIDGE_BUS_ARN` | Custom event bus ARN (from foundation outputs) |
| `COGNITO_USER_POOL_ID` | Cognito user pool ID (from foundation outputs) |
| `VPC_ID` | VPC ID (from foundation outputs) |
| `AWS_REGION` | AWS region (default: us-east-2) |

## First-Run Verification

After deployment, verify the pipeline:

1. Check CloudWatch dashboards for all contexts reporting healthy
2. Verify EventBridge Schema Registry has all event schemas
3. Test ingestion by sending a sample ServiceNow webhook
4. Confirm audit trail table is recording entries
