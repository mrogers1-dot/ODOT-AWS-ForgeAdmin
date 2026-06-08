# Task Group 03: Ingestion Context

**Bounded Context:** Ingestion
**Internal Pattern:** Simple Lambda handlers
**Dependencies:** Task Group 01 (foundation deployed), Task Group 02 (event schemas defined)
**Terraform State:** `forgeadmin/ingestion/terraform.tfstate`

---

## Tasks

- [ ] 4.1 Create Ingestion Terraform module
  - Create `terraform/contexts/ingestion/main.tf` with S3 backend key `forgeadmin/ingestion/terraform.tfstate`
  - Create `terraform/contexts/ingestion/dynamodb.tf`: work items table with GSI `sourceSystem-originalId-index` for deduplication, `force_destroy = true`, on-demand capacity, PITR enabled
  - Create `terraform/contexts/ingestion/lambda.tf`: three Lambda functions (ServiceNow poller, SES handler, FortiSIEM webhook), EventBridge rule for scheduled polling
  - Create `terraform/contexts/ingestion/api-gateway.tf`: FortiSIEM webhook endpoint
  - Create `terraform/contexts/ingestion/ses.tf`: SES receipt rule for `servers@dot.ohio.gov`
  - Create `terraform/contexts/ingestion/iam.tf`: per-Lambda IAM roles with least-privilege
  - SSM lookups for EventBridge bus ARN
  - _Requirements: 1.1, 1.2, 1.3, 15.1, 15.2_

- [ ] 4.2 Implement WorkItem normalizer and deduplication checker
  - Create `src/contexts/ingestion/normalizer.ts`: transforms ServiceNow, email, FortiSIEM payloads into common `WorkItem` interface
  - Create `src/contexts/ingestion/deduplication.ts`: DynamoDB lookup by `sourceSystem + originalId`, skip if exists, log duplicate detection
  - Create `src/contexts/ingestion/models.ts`: TypeScript interfaces for WorkItem, source-specific payloads
  - _Requirements: 1.4, 1.7_

- [ ] 4.3 Implement ServiceNow poller Lambda
  - Create `src/contexts/ingestion/handlers/servicenow-poller.ts`: scheduled Lambda polling ServiceNow API
  - Implement polling logic with last-checked timestamp tracking
  - Integrate normalizer, deduplication checker, and EventBridge publishing (`work-item.created`)
  - Implement error handling: exponential backoff on failure, Teams/Slack notification after 3 consecutive failures
  - Apply structured logging with correlationId and X-Ray tracing
  - _Requirements: 1.1, 1.5_

- [ ] 4.4 Implement SES email handler Lambda
  - Create `src/contexts/ingestion/handlers/ses-handler.ts`: triggered by SES receipt rule
  - Parse email extracting: sender address, subject line, received timestamp, body content
  - Handle unparseable emails: create work item with available fields, flag for manual review, notify Teams/Slack
  - Integrate normalizer, deduplication, EventBridge publishing
  - _Requirements: 1.2, 1.6_

- [ ] 4.5 Implement FortiSIEM webhook Lambda
  - Create `src/contexts/ingestion/handlers/fortisiem-webhook.ts`: API Gateway triggered Lambda
  - Validate incoming webhook payload, normalize to WorkItem format
  - Integrate normalizer, deduplication, EventBridge publishing
  - Implement retry logic with exponential backoff capped at 5 minutes
  - _Requirements: 1.3, 1.5_

- [ ] 4.6 Implement EventBridge event publisher for Ingestion
  - Create `src/contexts/ingestion/publisher.ts`: publishes `work-item.created` events conforming to EventEnvelope standard and JSON Schema contract
  - Validate events against schema before publishing
  - Include correlationId propagation
  - _Requirements: 1.4, 15.4_

- [ ]* 4.7 Write unit tests for Ingestion context
  - Test normalizer with various ServiceNow, email, FortiSIEM payloads
  - Test deduplication logic (duplicate detected, new item)
  - Test error handling paths (unparseable email, source unavailable)
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

---

## Wave Assignment

| Task | Wave |
|------|------|
| 4.1 | 3 |
| 4.2 | 4 |
| 4.3, 4.4, 4.5, 4.6 | 5 |
| 4.7 | 6 |
