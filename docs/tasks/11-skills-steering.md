# Task Group 11: Skills & Steering — Agent Growth System

## Overview

This task group implements the Skills & Steering system that allows team leads to expand and fine-tune agent capabilities over time through prompt-injection documents.

## Architecture

- **Storage**: S3 versioned documents + DynamoDB index (same pattern as runbooks)
- **Scope**: Global (all agents) or agent-specific
- **Management**: Dashboard CRUD by team_lead role only
- **Runtime**: Prompt composition adapter in Orchestration fetches docs at invocation time
- **Versioning**: Full version history with rollback to any prior version
- **Activation**: Immediate on next agent invocation (no redeployment needed)

## Tasks

- [x] 12.1 Add Skills/Steering infrastructure to Dashboard Terraform
  - **RED**: Write a `terraform validate` check confirming the new resources validate
  - **GREEN**: Add S3 paths, DynamoDB index table, Lambda functions for Skills/Steering CRUD to Dashboard Terraform module
  - **REFACTOR**: Ensure naming is consistent with existing dashboard resources
  - _Requirements: 17.1, 17.2, 17.3, 17.4_

- [x] 12.2 Implement Skills/Steering API Lambda handlers
  - **RED**: Write tests: (1) POST /skills creates skill with version 1, (2) PUT /skills/:id creates new version, (3) DELETE /skills/:id marks as deleted (soft), (4) POST /steering creates steering doc, (5) POST /steering/:id/rollback reverts to specified version, (6) team_member role gets 403 on write operations, (7) GET returns docs filtered by scope/agent
  - **GREEN**: Create `src/contexts/dashboard/api/handlers/skills.ts`: CRUD operations with versioning. Create `src/contexts/dashboard/api/handlers/steering.ts`: CRUD operations with rollback support. Implement RBAC (team_lead write, all read). Publish `skill.updated` and `steering.updated` events.
  - **REFACTOR**: Extract versioning logic into shared utility (reusable for runbooks); ensure rollback is atomic
  - _Requirements: 17.1, 17.2, 17.3, 17.6, 17.10, 17.11, 17.12_

- [x] 12.3 Implement prompt composition adapter (Orchestration)
  - **RED**: Write tests: (1) fetches global + agent-specific docs for given agent, (2) respects priority ordering (agent-specific > global), (3) truncates when token budget exceeded (drops global first), (4) returns empty array gracefully when storage unavailable, (5) never blocks work item processing
  - **GREEN**: Create `src/contexts/orchestration/adapters/skill-steering-provider.ts`: implements ISkillSteeringProvider. Pull model — reads docs at invocation time from S3/DynamoDB. Priority-based truncation (global docs dropped first on budget overflow). Graceful degradation: proceed with base prompt if storage unavailable.
  - **REFACTOR**: Add caching for warm Lambda starts; ensure token budget calculation is accurate
  - _Requirements: 17.5, 17.7, 17.8_

- [x] 12.4 Integrate prompt composition into agent invocation pipeline
  - **RED**: Write tests: (1) agent prompt includes injected skill docs, (2) agent prompt includes injected steering docs, (3) missing skills/steering doesn't break agent invocation, (4) prompt order is correct (system → steering → skills → user context)
  - **GREEN**: Modify agent invocation in Step Functions task handlers to call ISkillSteeringProvider before model invocation. Compose prompt: base system prompt + steering docs + skill docs + work item context.
  - **REFACTOR**: Ensure prompt composition is testable in isolation; validate token counts don't exceed model limits
  - _Requirements: 17.5, 17.6, 17.8_

- [x] 12.5 Implement Skills/Steering Dashboard UI
  - **RED**: Write tests: (1) skills list renders with name/scope/version, (2) steering list renders with rollback history, (3) create form submits valid payload, (4) rollback button reverts to selected version, (5) viewer role sees read-only view
  - **GREEN**: Create skills management page: list, create, edit, delete. Create steering management page: list, create, edit, rollback, delete. Version history display. Scope selector (global vs agent-specific).
  - **REFACTOR**: Extract version history component for reuse; ensure form validation matches API constraints
  - _Requirements: 17.1, 17.2, 17.3, 17.9, 17.11_

- [x] 12.6 Add event schemas for skill/steering updates
  - **RED**: Write contract test validating schemas follow EventEnvelope standard
  - **GREEN**: Create `contracts/events/dashboard/skill.updated.schema.json` and `contracts/events/dashboard/steering.updated.schema.json` (already done in Wave 1 3.1)
  - **REFACTOR**: Verify existing schemas match actual event payload from API handlers
  - _Requirements: 17.10, 17.12, 15.4_

- [x] 12.7 Add notification handling for skill/steering changes
  - **RED**: Write tests: (1) skill.updated event triggers notification to team leads, (2) steering.updated event triggers notification, (3) notification includes skill/steering name and change type
  - **GREEN**: Subscribe Communication context to `skill.updated` and `steering.updated` events. Route notifications to Teams/Slack targeting team_lead recipients.
  - **REFACTOR**: Ensure notification format is consistent with other notification types
  - _Requirements: 17.12_

## Dependencies

- Depends on: Dashboard Terraform (10.1), Orchestration adapters (5.10)
- Consumed by: All agent invocations in Orchestration context
- Events consumed by: Communication (notifications), Platform (audit)

---

## Wave Assignment

| Task | Wave |
|------|------|
| 12.1 | 7 |
| 12.2, 12.3, 12.4 | 8 |
| 12.5, 12.6, 12.7 | 9 |
