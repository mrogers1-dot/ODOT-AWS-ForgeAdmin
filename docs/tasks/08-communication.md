# Task Group 08: Communication Context

**Bounded Context:** Communication
**Internal Pattern:** Simple Lambda handlers
**Dependencies:** Task Group 01 (foundation), Task Group 02 (event schemas)
**Terraform State:** `forgeadmin/communication/terraform.tfstate`

---

## Tasks

- [ ] 11.1 Create Communication Terraform module
  - Create `terraform/contexts/communication/main.tf` with S3 backend key `forgeadmin/communication/terraform.tfstate`
  - Create `terraform/contexts/communication/sqs.tf`: communication queue (rate limit isolation), DLQ
  - Create `terraform/contexts/communication/dynamodb.tf`: notification state table (30-day TTL), `force_destroy = true`
  - Create `terraform/contexts/communication/lambda.tf`: notification dispatcher, morning digest, NL command handler, escalation handler
  - Create `terraform/contexts/communication/eventbridge.tf`: scheduled rule for 7:00 AM ET morning digest, event rules for notification triggers
  - Create `terraform/contexts/communication/iam.tf`: Lambda roles with SQS, DynamoDB, EventBridge access
  - _Requirements: 12.1, 12.2, 15.1, 15.2_

- [ ] 11.2 Implement notification dispatcher
  - Create `src/contexts/communication/handlers/notification-dispatcher.ts`: routes events to Teams/Slack within 30 seconds
  - Implement notification types: auto-executed actions, approval requests, execution failures, system alerts
  - Implement retry logic: 3 attempts with exponential backoff on delivery failure
  - Implement escalation to alternative method (email/Dashboard alert) when timing SLAs violated
  - Log failures in audit trail, display undelivered notifications on Dashboard
  - _Requirements: 12.1, 12.3, 12.5_

- [ ] 11.3 Implement morning digest generator
  - Create `src/contexts/communication/handlers/morning-digest.ts`: scheduled at 7:00 AM Eastern
  - Compile overnight activity (7PM-7AM): activity summary, pending approvals with age, module health, anomalies
  - Format for Teams/Slack delivery
  - _Requirements: 12.2_

- [ ] 11.4 Implement natural language command handler
  - Create `src/contexts/communication/handlers/nl-command-handler.ts`: processes Teams/Slack messages
  - Support status queries: module state, pending approvals, recent execution outcomes
  - Support commands: approve/reject pending proposals, toggle module state
  - Respond within 30 seconds of receiving message
  - _Requirements: 12.4_

- [ ]* 11.5 Write unit tests for Communication context
  - Test notification routing and retry logic
  - Test morning digest compilation
  - Test NL command parsing and response generation
  - Test escalation paths
  - _Requirements: 12.1-12.5_

---

## Wave Assignment

| Task | Wave |
|------|------|
| 11.1 | 3 |
| 11.2, 11.3, 11.4 | 8 |
| 11.5 | 9 |
