# Task Group 05: Knowledge Base Context

**Bounded Context:** Knowledge Base
**Internal Pattern:** Simple Lambda handlers
**Dependencies:** Task Group 01 (foundation), Task Group 04 (orchestration publishes events KB consumes)
**Terraform State:** `forgeadmin/knowledge-base/terraform.tfstate`

---

## Tasks

- [x] 7.1 Create Knowledge Base Terraform module
  - **RED**: Write a `terraform validate` check for the knowledge-base context module
  - **GREEN**: Create `terraform/contexts/knowledge-base/main.tf` with S3 backend key `forgeadmin/knowledge-base/terraform.tfstate`. Create `terraform/contexts/knowledge-base/bedrock.tf`: Bedrock Knowledge Base configuration, data source (S3 bucket). Create `terraform/contexts/knowledge-base/dynamodb.tf`: knowledge gap tracker table, `force_destroy = true`. Create `terraform/contexts/knowledge-base/s3.tf`: KB source documents bucket, runbooks bucket (versioned), `force_destroy = true`. Create `terraform/contexts/knowledge-base/lambda.tf`: query handler, runbook generator, KB updater Lambda functions. Create `terraform/contexts/knowledge-base/iam.tf`: Bedrock access, S3 read/write roles.
  - **REFACTOR**: Validate IAM roles are minimal; ensure S3 lifecycle policies are documented
  - _Requirements: 3.1, 8.1, 8.2, 15.1, 15.2_

- [x] 7.2 Implement KB query handler
  - **RED**: Write tests: (1) query with matching items returns ranked list with relevance scores, (2) items below 0.3 threshold are excluded, (3) max 10 items returned even if more match, (4) empty results return empty array, (5) Bedrock KB unavailability returns error result (not exception)
  - **GREEN**: Create `src/contexts/knowledge-base/handlers/query-handler.ts`: receives research queries, queries Bedrock KB. Implement relevance scoring (0.0-1.0), filter items below 0.3 threshold. Return ranked list of up to 10 knowledge items. Handle Bedrock KB unavailability gracefully.
  - **REFACTOR**: Extract relevance threshold to configuration; ensure response format matches IKnowledgeBase port contract
  - _Requirements: 3.1, 3.2, 3.3, 3.6_

- [x] 7.3 Implement runbook generator
  - **RED**: Write tests: (1) valid work-item.resolved event produces structured runbook with all required sections, (2) runbook is stored in S3 with versioning, (3) `runbook.generated` event is published, (4) 10-minute soft timeout continues processing, (5) missing work item data produces runbook with placeholder sections flagged for review
  - **GREEN**: Create `src/contexts/knowledge-base/handlers/runbook-generator.ts`: triggered by `work-item.resolved` events for knowledge gap items. Generate structured runbooks containing: title, applicable incident types, prerequisites, step-by-step procedure, expected outcomes, rollback steps. Store in S3 with versioning. Publish `runbook.generated` event. 10-minute soft timeout (continue if still processing).
  - **REFACTOR**: Extract runbook template into configurable format; ensure versioning preserves full history
  - _Requirements: 8.2, 8.3, 8.5_

- [x] 7.4 Implement KB updater
  - **RED**: Write tests: (1) execution.completed event updates KB with resolution steps, (2) verification.completed event adds verification context, (3) failed update retries 3 times at 30-second intervals, (4) persistent failure notifies Teams/Slack, (5) updates include root cause and affected systems
  - **GREEN**: Create `src/contexts/knowledge-base/handlers/kb-updater.ts`: triggered by `execution.completed` and `verification.completed` events. Update KB with resolution steps, root cause, affected systems. Implement retry logic (3 attempts, 30-second intervals) on failure. Notify Teams/Slack channel on persistent failure.
  - **REFACTOR**: Extract retry logic to shared utility; ensure idempotent updates (re-processing same event is safe)
  - _Requirements: 3.5, 8.1, 8.6_

---

## Wave Assignment

| Task | Wave |
|------|------|
| 7.1 | 3 |
| 7.2, 7.3, 7.4 | 6 |
