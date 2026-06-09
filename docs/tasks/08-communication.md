# Task Group 08: Communication Context

**Bounded Context:** Communication
**Internal Pattern:** Simple Lambda handlers
**Dependencies:** Task Group 01 (foundation), Task Group 02 (event schemas)
**Terraform State:** `forgeadmin/communication/terraform.tfstate`

---

## Tasks

- [x] 11.1 Create Communication Terraform module
  - **RED**: Write a `terraform validate` check for the communication context module
  - **GREEN**: Create `terraform/contexts/communication/main.tf` with S3 backend key `forgeadmin/communication/terraform.tfstate`. Create `terraform/contexts/communication/sqs.tf`: communication queue (rate limit isolation), DLQ. Create `terraform/contexts/communication/dynamodb.tf`: notification state table (30-day TTL), `force_destroy = true`. Create `terraform/contexts/communication/lambda.tf`: notification dispatcher, morning digest, NL command handler, escalation handler. Create `terraform/contexts/communication/eventbridge.tf`: scheduled rule for 7:00 AM ET morning digest, event rules for notification triggers. Create `terraform/contexts/communication/iam.tf`: Lambda roles with SQS, DynamoDB, EventBridge access.
  - **REFACTOR**: Validate rate limiting configuration; ensure DLQ alerting is configured
  - _Requirements: 12.1, 12.2, 15.1, 15.2_

- [x] 11.2 Implement notification dispatcher
  - **RED**: Write tests: (1) event routes to Teams/Slack within 30-second budget, (2) auto-executed action notification includes plan summary, (3) delivery failure retries 3 times with exponential backoff, (4) timing SLA violation escalates to email, (5) persistent failure logs to audit trail and shows on Dashboard, (6) three-tier escalation: Teams/Slack → email → Dashboard alert
  - **GREEN**: Create `src/contexts/communication/handlers/notification-dispatcher.ts`: routes events to Teams/Slack within 30 seconds. Implement notification types: auto-executed actions, approval requests, execution failures, system alerts. Implement retry logic: 3 attempts with exponential backoff on delivery failure. Implement escalation to alternative method (email/Dashboard alert) when timing SLAs violated. Log failures in audit trail, display undelivered notifications on Dashboard.
  - **REFACTOR**: Extract notification formatting into templates; ensure escalation logic is configurable per notification type
  - _Requirements: 12.1, 12.3, 12.5_

- [x] 11.3 Implement morning digest generator
  - **RED**: Write tests: (1) digest compiles overnight activity (7PM-7AM), (2) includes pending approvals with age, (3) includes module health summary, (4) includes anomaly detection results, (5) empty overnight produces "no activity" digest
  - **GREEN**: Create `src/contexts/communication/handlers/morning-digest.ts`: scheduled at 7:00 AM Eastern. Compile overnight activity (7PM-7AM): activity summary, pending approvals with age, module health, anomalies. Format for Teams/Slack delivery.
  - **REFACTOR**: Extract time window calculation to testable utility; ensure timezone handling is correct (Eastern)
  - _Requirements: 12.2_

- [x] 11.4 Implement natural language command handler
  - **RED**: Write tests: (1) "status" query returns module state summary, (2) "approve [id]" approves pending proposal, (3) "reject [id]" rejects with reason, (4) unknown command returns help text, (5) responds within 30 seconds, (6) unauthorized user gets denial message, (7) identity mapping resolves Teams/Slack user to Cognito role
  - **GREEN**: Create `src/contexts/communication/handlers/nl-command-handler.ts`: processes Teams/Slack messages. Support status queries: module state, pending approvals, recent execution outcomes. Support commands: approve/reject pending proposals, toggle module state. Respond within 30 seconds of receiving message. Implement identity mapping (Teams/Slack user ID → Cognito role) with full RBAC enforcement.
  - **REFACTOR**: Extract command parsing into grammar module; ensure RBAC check is consistent with Dashboard API
  - _Requirements: 12.4_

---

## Wave Assignment

| Task | Wave |
|------|------|
| 11.1 | 3 |
| 11.2, 11.3, 11.4 | 8 |
