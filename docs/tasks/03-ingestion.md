# Task Group 03: Ingestion Context

**Bounded Context:** Ingestion
**Internal Pattern:** Simple Lambda handlers
**Dependencies:** Task Group 01 (foundation deployed), Task Group 02 (event schemas defined)
**Terraform State:** `forgeadmin/ingestion/terraform.tfstate`

---

## Tasks

- [ ] 4.1 Create Ingestion Terraform module
  - **RED**: Write a `terraform validate` check expecting the ingestion module to validate cleanly
  - **GREEN**: Create `terraform/contexts/ingestion/main.tf` with S3 backend key `forgeadmin/ingestion/terraform.tfstate`. Create `terraform/contexts/ingestion/dynamodb.tf`: work items table with GSI `sourceSystem-originalId-index` for deduplication, DynamoDB Streams enabled, `force_destroy = true`, on-demand capacity, PITR enabled. Create `terraform/contexts/ingestion/lambda.tf`: three Lambda functions (ServiceNow poller, SES handler, FortiSIEM webhook), EventBridge rule for scheduled polling. Create `terraform/contexts/ingestion/api-gateway.tf`: FortiSIEM webhook endpoint. Create `terraform/contexts/ingestion/ses.tf`: SES receipt rule for `servers@dot.ohio.gov`. Create `terraform/contexts/ingestion/sqs.tf`: ingestion DLQ for failed processing. Create `terraform/contexts/ingestion/iam.tf`: per-Lambda IAM roles with least-privilege. SSM lookups for EventBridge bus ARN.
  - **REFACTOR**: Extract Lambda resource patterns into local module; validate IAM policies are minimal
  - _Requirements: 1.1, 1.2, 1.3, 15.1, 15.2_

- [ ] 4.2 Implement WorkItem normalizer and deduplication checker
  - **RED**: Write tests: (1) normalizer transforms a ServiceNow payload into correct WorkItem format, (2) normalizer transforms an email payload into correct WorkItem format, (3) normalizer transforms a FortiSIEM payload into correct WorkItem format, (4) deduplication returns true for existing item, false for new item
  - **GREEN**: Create `src/contexts/ingestion/normalizer.ts`: transforms ServiceNow, email, FortiSIEM payloads into common `WorkItem` interface. Create `src/contexts/ingestion/deduplication.ts`: DynamoDB lookup by `sourceSystem + originalId`, skip if exists, log duplicate detection. Create `src/contexts/ingestion/models.ts`: TypeScript interfaces for WorkItem, source-specific payloads.
  - **REFACTOR**: Extract common field mapping logic; ensure all source-specific fields are preserved in metadata
  - _Requirements: 1.4, 1.7_

- [ ] 4.3 Implement ServiceNow poller Lambda
  - **RED**: Write tests: (1) successful poll creates work items and publishes events, (2) poll with no new items does nothing, (3) source unavailable triggers exponential backoff, (4) 3 consecutive failures triggers Teams/Slack notification
  - **GREEN**: Create `src/contexts/ingestion/handlers/servicenow-poller.ts`: scheduled Lambda polling ServiceNow API. Implement polling logic with last-checked timestamp tracking. Integrate normalizer, deduplication checker, and EventBridge publishing (`work-item.created`). Implement error handling: exponential backoff on failure, Teams/Slack notification after 3 consecutive failures. Apply structured logging with correlationId and X-Ray tracing.
  - **REFACTOR**: Extract retry/backoff logic into shared utility; ensure timestamp tracking is atomic
  - _Requirements: 1.1, 1.5_

- [ ] 4.4 Implement SES email handler Lambda
  - **RED**: Write tests: (1) valid email creates work item with all fields, (2) email with missing subject still creates work item flagged for manual review, (3) empty body email creates work item flagged for manual review and notifies Teams/Slack, (4) duplicate email is skipped
  - **GREEN**: Create `src/contexts/ingestion/handlers/ses-handler.ts`: triggered by SES receipt rule. Parse email extracting: sender address, subject line, received timestamp, body content. Handle unparseable emails: create work item with available fields, flag for manual review, notify Teams/Slack. Integrate normalizer, deduplication, EventBridge publishing.
  - **REFACTOR**: Extract email parsing into separate testable module; validate edge cases for multipart emails
  - _Requirements: 1.2, 1.6_

- [ ] 4.5 Implement FortiSIEM webhook Lambda
  - **RED**: Write tests: (1) valid webhook creates work item and publishes event, (2) invalid payload returns 400, (3) retry with exponential backoff on transient failure, (4) backoff caps at 5 minutes
  - **GREEN**: Create `src/contexts/ingestion/handlers/fortisiem-webhook.ts`: API Gateway triggered Lambda. Validate incoming webhook payload, normalize to WorkItem format. Integrate normalizer, deduplication, EventBridge publishing. Implement retry logic with exponential backoff capped at 5 minutes.
  - **REFACTOR**: Ensure payload validation returns actionable error messages; align retry pattern with ServiceNow poller
  - _Requirements: 1.3, 1.5_

- [ ] 4.6 Implement EventBridge event publisher for Ingestion
  - **RED**: Write tests: (1) valid work item produces conformant `work-item.created` event, (2) event passes JSON Schema validation, (3) correlationId is propagated from input, (4) invalid event fails schema validation before publish
  - **GREEN**: Create `src/contexts/ingestion/publisher.ts`: publishes `work-item.created` events conforming to EventEnvelope standard and JSON Schema contract. Validate events against schema before publishing. Include correlationId propagation.
  - **REFACTOR**: Extract schema validation into shared contract-validator usage; ensure publisher is reusable across contexts
  - _Requirements: 1.4, 15.4_

---

## Wave Assignment

| Task | Wave |
|------|------|
| 4.1 | 3 |
| 4.2 | 4 |
| 4.3, 4.4, 4.5, 4.6 | 5 |
