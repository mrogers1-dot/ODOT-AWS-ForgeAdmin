# ADR-0005: Terraform Independent State Per Context

## Status

Accepted

## Context

ForgeAdmin deploys 7 bounded contexts plus a foundation layer. We need an infrastructure-as-code strategy that supports:

- Independent deployment and destruction of each context
- Parallel context deployment for speed
- Blast radius isolation — a bad Terraform plan in one context doesn't affect others
- Shared infrastructure (EventBridge, VPC, Cognito) available to all contexts

A single monolithic Terraform state would create lock contention, increase blast radius, and prevent independent context lifecycle management.

## Decision

Each bounded context gets its own Terraform state file in S3:

1. **Foundation** (`forgeadmin/foundation/terraform.tfstate`) — Shared infra deployed first, destroyed last
2. **Per-context** (`forgeadmin/{context}/terraform.tfstate`) — Independent lifecycle, parallel deploy/destroy
3. **Cross-context references** — Via SSM Parameter Store lookups (foundation publishes, contexts consume)
4. **Environment configs** — Shared `.tfvars` files per environment in `terraform/environments/`

Deployment order: Foundation → All contexts (parallel). Destruction order: All contexts (parallel) → Foundation.

## Consequences

### Positive

- `destroy-context.sh ingestion` destroys only ingestion — no impact on other contexts
- Parallel `terraform apply` across contexts reduces deployment time
- State file corruption isolated to a single context
- Foundation resources protected from accidental context-level destruction

### Negative

- Cross-context references require SSM lookups (slight complexity)
- Must ensure foundation is applied before any context
- More state files to manage (8 total)

### Neutral

- S3 backend with DynamoDB locking provides state consistency
- Each context's Terraform is fully self-contained in its directory
- Scripts automate the correct ordering
