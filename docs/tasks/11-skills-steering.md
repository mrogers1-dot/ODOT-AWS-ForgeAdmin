# Task Group 11: Skills & Steering — Agent Growth System

## Overview

This task group implements the Skills & Steering system that allows team leads to expand and fine-tune agent capabilities over time through prompt-injection documents. Skills define what agents CAN do (new capabilities); Steering docs define HOW agents behave (behavioral guidelines).

## Architecture

- **Storage**: S3 versioned documents + DynamoDB index (same pattern as runbooks)
- **Scope**: Global (all agents) or agent-specific
- **Management**: Dashboard CRUD by team_lead role only
- **Runtime**: Prompt composition adapter in Orchestration fetches docs at invocation time
- **Versioning**: Full version history with rollback to any prior version
- **Activation**: Immediate on next agent invocation (no redeployment needed)

## Tasks

| Task | Description | Requirements |
|------|-------------|--------------|
| 12.1 | Add Skills/Steering infrastructure to Dashboard Terraform | 17.1, 17.2, 17.3, 17.4 |
| 12.2 | Implement Skills/Steering API Lambda handlers | 17.1, 17.2, 17.3, 17.6, 17.10, 17.11, 17.12 |
| 12.3 | Implement prompt composition adapter (Orchestration) | 17.5, 17.7, 17.8 |
| 12.4 | Integrate prompt composition into agent invocation pipeline | 17.5, 17.6, 17.8 |
| 12.5 | Implement Skills/Steering Dashboard UI | 17.1, 17.2, 17.3, 17.9, 17.11 |
| 12.6 | Add event schemas for skill/steering updates | 17.10, 17.12, 15.4 |
| 12.7 | Add notification handling for skill/steering changes | 17.12 |
| 12.8 | Write unit tests for Skills & Steering (consolidation) | 17.1-17.12 |

## Key Design Decisions

- **Prompt-only approach**: Skills expand capabilities through LLM instructions, not dynamic tool registration. This keeps infrastructure simple and allows team leads to author skills without code changes.
- **S3 + DynamoDB hybrid**: Documents in S3 (versioned, cheap storage for markdown), index in DynamoDB (fast queries by scope/agent). Matches existing runbook pattern.
- **Pull model**: Orchestration reads docs at invocation time (not pushed via events). Ensures immediate effect and avoids stale caches.
- **Priority-based truncation**: When token budget is exceeded, global docs are dropped first, preserving agent-specific docs (most targeted = most important).
- **Graceful degradation**: If storage is unavailable, agents proceed with base prompt only — never blocks work item processing.

## Dependencies

- Depends on: Dashboard Terraform (10.1), Orchestration adapters (5.10)
- Consumed by: All agent invocations in Orchestration context
- Events consumed by: Communication (notifications), Platform (audit)
