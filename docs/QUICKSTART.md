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
# Foundation
cd terraform/foundation
terraform init -backend=false
terraform validate

# All context modules (8 total)
for dir in terraform/contexts/*/; do
  cd "$dir"
  terraform init -backend=false
  terraform validate
  cd -
done
```

### 5. Validate contracts

> **Note:** The `validate:contracts` script (`scripts/validate-contracts.ts`) is defined in `package.json` but not yet implemented. Contract validation logic exists in `src/shared/src/contract-validator.ts` and is exercised by unit tests. To validate schemas manually, run `pnpm test` which includes contract validation test suites.

```bash
pnpm validate:contracts
```

## Deployment

### Deploy everything (foundation first, then contexts in parallel)

```bash
./terraform/scripts/deploy-all.sh        # defaults to 'dev'
./terraform/scripts/deploy-all.sh dev    # explicit environment
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
│   ├── api/                # OpenAPI specifications
│   ├── command-registry/   # PowerShell command definitions (AD, DNS, Services)
│   ├── correlation-rules/  # Incident correlation rule schemas
│   └── events/             # JSON Schema event contracts (26 schemas)
├── docs/
│   ├── adr/                # Architecture Decision Records
│   ├── architecture/       # Context maps, diagrams
│   ├── superpowers/        # Feature design specs
│   └── tasks/              # Implementation task groups
├── src/
│   ├── shared/             # Shared utilities (@forgeadmin/shared)
│   ├── integration/        # End-to-end integration tests
│   └── contexts/           # Bounded context implementations
│       ├── communication/  # Notification dispatcher, morning digest, NL commands
│       ├── correlation/    # Incident correlation engine (rule evaluator, sessions)
│       ├── dashboard/      # API, frontend (React), WebSocket, domain logic
│       ├── execution/      # On-prem bridge, playbook expander, orchestrator
│       ├── ingestion/      # ServiceNow/Email/FortiSIEM normalizers, dedup
│       ├── knowledge-base/ # Query handler, runbook generator, feedback capture
│       ├── orchestration/  # Multi-agent pipeline (Triage, Research, Planning, Verification, Supervisor)
│       └── platform/       # Audit trail, circuit breaker, degradation monitor
├── terraform/
│   ├── foundation/         # Shared infra (EventBridge, VPC, Cognito, IAM)
│   ├── contexts/           # Per-context Terraform modules (8 modules)
│   ├── environments/       # Environment-specific variables (dev.tfvars)
│   └── scripts/            # Deploy/destroy/validate automation
│       ├── deploy-all.sh           # Full deploy: foundation first, contexts parallel
│       ├── destroy-all.sh          # Full teardown: contexts first, foundation last
│       ├── destroy-context.sh      # Single context teardown
│       ├── validate-context.sh     # Validate a single context module
│       ├── validate-foundation.sh  # Validate foundation module
│       ├── validate-platform.sh    # Validate platform module
│       └── validate-scripts.sh     # Validate all scripts syntax
├── .github/workflows/      # CI/CD (PR checks + Terraform deploy)
├── scripts/                # Utility scripts
│   ├── add-cognito-users.sh        # Create Cognito user accounts
│   ├── bootstrap-state.sh          # One-time Terraform state backend setup
│   ├── configure-ssm-params.sh     # Set SSM Parameter Store values
│   ├── deploy-frontend.sh          # Build and deploy React SPA to S3/CloudFront
│   ├── seed-knowledge-base.ts      # Upload runbooks to KB S3 + trigger Bedrock sync
│   └── verify-deployment.sh        # Post-deploy health check
└── seed-runbooks/          # Runbook .md files to seed the Knowledge Base
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
