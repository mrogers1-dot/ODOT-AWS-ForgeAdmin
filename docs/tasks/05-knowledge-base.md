# Task Group 05: Knowledge Base Context

**Bounded Context:** Knowledge Base
**Internal Pattern:** Simple Lambda handlers
**Dependencies:** Task Group 01 (foundation), Task Group 04 (orchestration publishes events KB consumes)
**Terraform State:** `forgeadmin/knowledge-base/terraform.tfstate`

---

## Tasks

- [ ] 7.1 Create Knowledge Base Terraform module
  - Create `terraform/contexts/knowledge-base/main.tf` with S3 backend key `forgeadmin/knowledge-base/terraform.tfstate`
  - Create `terraform/contexts/knowledge-base/bedrock.tf`: Bedrock Knowledge Base configuration, data source (S3 bucket)
  - Create `terraform/contexts/knowledge-base/dynamodb.tf`: knowledge gap tracker table, `force_destroy = true`
  - Create `terraform/contexts/knowledge-base/s3.tf`: KB source documents bucket, runbooks bucket (versioned), `force_destroy = true`
  - Create `terraform/contexts/knowledge-base/lambda.tf`: query handler, runbook generator, KB updater Lambda functions
  - Create `terraform/contexts/knowledge-base/iam.tf`: Bedrock access, S3 read/write roles
  - _Requirements: 3.1, 8.1, 8.2, 15.1, 15.2_

- [ ] 7.2 Implement KB query handler
  - Create `src/contexts/knowledge-base/handlers/query-handler.ts`: receives research queries, queries Bedrock KB
  - Implement relevance scoring (0.0-1.0), filter items below 0.3 threshold
  - Return ranked list of up to 10 knowledge items
  - Handle Bedrock KB unavailability gracefully
  - _Requirements: 3.1, 3.2, 3.3, 3.6_

- [ ] 7.3 Implement runbook generator
  - Create `src/contexts/knowledge-base/handlers/runbook-generator.ts`: triggered by `work-item.resolved` events for knowledge gap items
  - Generate structured runbooks containing: title, applicable incident types, prerequisites, step-by-step procedure, expected outcomes, rollback steps
  - Store in S3 with versioning
  - Publish `runbook.generated` event
  - 10-minute soft timeout (continue if still processing)
  - _Requirements: 8.2, 8.3, 8.5_

- [ ] 7.4 Implement KB updater
  - Create `src/contexts/knowledge-base/handlers/kb-updater.ts`: triggered by `execution.completed` and `verification.completed` events
  - Update KB with resolution steps, root cause, affected systems
  - Implement retry logic (3 attempts, 30-second intervals) on failure
  - Notify Teams/Slack channel on persistent failure
  - _Requirements: 3.5, 8.1, 8.6_

- [ ]* 7.5 Write unit tests for Knowledge Base context
  - Test query handler relevance scoring and threshold filtering
  - Test runbook generator output structure validation
  - Test KB updater retry logic
  - _Requirements: 3.1-3.6, 8.1-8.6_

---

## Wave Assignment

| Task | Wave |
|------|------|
| 7.1 | 3 |
| 7.2, 7.3, 7.4 | 6 |
| 7.5 | 7 |
