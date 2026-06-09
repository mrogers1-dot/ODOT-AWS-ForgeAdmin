# Task Group 01: Platform Foundation & Shared Infrastructure

**Bounded Context:** Platform/Infra
**Dependencies:** None (first to deploy)
**Destroy Order:** Last (all contexts depend on this)

---

## Tasks

- [x] 1.1 Create monorepo directory structure and project configuration
  - Create top-level directory structure: `terraform/foundation/`, `terraform/contexts/{ingestion,orchestration,execution,knowledge-base,dashboard,communication,platform}/`, `terraform/scripts/`, `terraform/environments/`, `contracts/events/`, `contracts/api/`, `docs/adr/`, `src/shared/`
  - Initialize root `package.json` with TypeScript, Vitest, ESLint, fast-check dependencies
  - Create `tsconfig.json` with strict mode and path aliases
  - Create `.eslintrc.json` enforcing structured logging and consistent patterns
  - _Requirements: 15.1, 15.4_

- [x] 1.2 Create Terraform foundation module — EventBridge, networking, IAM
  - Create `terraform/foundation/main.tf` with AWS provider configuration
  - Create `terraform/foundation/eventbridge.tf`: custom event bus `forgeadmin-events`, Schema Registry
  - Create `terraform/foundation/networking.tf`: VPC, Transit Gateway attachments, security groups
  - Create `terraform/foundation/iam-shared.tf`: cross-context IAM roles, least-privilege policies
  - Create `terraform/foundation/cognito.tf`: User Pool with `admin` and `viewer` roles
  - Create `terraform/foundation/outputs.tf`: SSM parameters for EventBridge bus ARN, VPC ID, Cognito pool ID
  - Create `terraform/foundation/backend.tf`: S3 backend with key `forgeadmin/foundation/terraform.tfstate`
  - Create `terraform/foundation/variables.tf` and `terraform/environments/dev.tfvars`
  - _Requirements: 15.1, 15.2, 13.3_

- [x] 1.3 Create Terraform platform context — observability, audit trail, circuit breaker
  - **RED**: Write a `terraform validate` check for the platform context module
  - **GREEN**: Create `terraform/contexts/platform/main.tf` with S3 backend key `forgeadmin/platform/terraform.tfstate`. Create `terraform/contexts/platform/dynamodb.tf`: audit trail table (single-table design with GSIs: `actor-timestamp-index`, `context-action-index`), DynamoDB Streams enabled, `force_destroy = true`. Create `terraform/contexts/platform/s3.tf`: storage bucket with lifecycle policies (90-day transition, Glacier after 1yr), `force_destroy = true`, versioning enabled. Create `terraform/contexts/platform/cloudwatch.tf`: dashboards (per-context + platform overview), alarms for DLQ depth (threshold > 0), error rate thresholds. Create `terraform/contexts/platform/sns.tf`: alarm notification topics. Create `terraform/contexts/platform/lambda.tf`: DLQ monitor Lambda, archival Lambda (DynamoDB Streams trigger). SSM parameter lookups for foundation outputs.
  - **REFACTOR**: Ensure all resources use consistent naming conventions; validate lifecycle policies are correct; verify DynamoDB Streams are configured for OLD_IMAGE
  - _Requirements: 13.1, 13.4, 13.5, 14.4, 9.1, 9.2_

- [x] 1.4 Create deployment scripts (deploy-all, destroy-all, destroy-context)
  - **RED**: Write a shellcheck/lint test that validates script syntax and error handling patterns
  - **GREEN**: Create `terraform/scripts/deploy-all.sh`: deploys foundation first, then all contexts in parallel. Create `terraform/scripts/destroy-all.sh`: destroys all contexts in parallel, then foundation last. Create `terraform/scripts/destroy-context.sh`: accepts context name argument, destroys single context. All scripts must validate prerequisites (AWS CLI, Terraform installed) and handle errors.
  - **REFACTOR**: Add usage documentation in script headers; ensure consistent exit code handling
  - _Requirements: 15.1_

- [x] 1.5 Create GitHub Actions CI/CD pipeline
  - **RED**: Write a workflow lint/validation check (actionlint) for the GitHub Actions YAML
  - **GREEN**: Create `.github/workflows/terraform-deploy.yml`: triggered on merge to main. Implement plan → validate → apply stages with 15-minute timeout. Add manual approval gate for resource destruction/replacement. Implement automatic rollback on failure. Add Terraform fmt/validate checks on PR. Create `.github/workflows/pr-checks.yml`: lint, typecheck, unit tests, contract validation.
  - **REFACTOR**: Extract reusable composite actions; ensure secrets are referenced not hardcoded
  - _Requirements: 15.3, 15.5, 15.6_

- [x] 1.6 Implement shared observability utilities
  - Create `src/shared/logging.ts`: structured JSON logger with `correlationId`, `context`, `action`, `level` fields
  - Create `src/shared/tracing.ts`: X-Ray tracing initialization helper for Lambdas
  - Create `src/shared/metrics.ts`: CloudWatch custom metrics helper (invocation count, error count, duration percentiles)
  - Create `src/shared/types.ts`: shared TypeScript types (EventEnvelope, CorrelationContext)
  - _Requirements: 13.1, 14.5_

---

## Checkpoint

- [ ] Ensure all Terraform validates successfully (`terraform validate` in each module)
- [ ] Verify deploy-all.sh and destroy-all.sh scripts execute without errors
- [ ] Verify CI/CD pipeline triggers correctly on PR and merge

## Wave Assignment

| Task | Wave |
|------|------|
| 1.1 | 0 |
| 1.2, 1.6 | 1 |
| 1.3, 1.4 | 2 |
| 1.5 | 3 |
