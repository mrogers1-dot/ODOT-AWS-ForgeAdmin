# Skills & Steering Docs — Agent Growth System

## Date: 2026-06-08

## Overview

ForgeAdmin agents start with hardcoded base behavior, but just like a Junior SysAdmin who learns and grows, they need a mechanism for team leads to expand their capabilities and fine-tune their decision-making over time. This feature introduces **Skills** (what an agent CAN do — new capabilities via prompt instructions) and **Steering Docs** (HOW an agent behaves — behavioral guidelines and decision-making rules).

Both are structured markdown documents with frontmatter metadata, managed through the Dashboard by team leads, stored in S3 with full version history, and injected into agent prompts at runtime.

## Key Decisions

- **Audience:** Team leads only (`team_lead` role) can create/edit/delete Skills and Steering docs
- **Structure:** Prompt-only documents (markdown with frontmatter) — no dynamic tool registration
- **Scope:** Two levels — global (all agents) and agent-specific
- **Versioning:** Full version history with rollback to any prior version (S3 versioning)
- **Activation:** Immediately effective on next agent invocation
- **Storage:** S3 for document content (versioned), DynamoDB for index/metadata

## Data Model

### S3 Storage Structure

```
s3://forgeadmin-storage-{env}/
├── skills/
│   ├── global/{skillId}/v{version}.md
│   └── agents/{agentName}/{skillId}/v{version}.md
└── steering/
    ├── global/{steeringId}/v{version}.md
    └── agents/{agentName}/{steeringId}/v{version}.md
```

### DynamoDB Table: skills-steering-index

| Attribute | Type | Description |
|-----------|------|-------------|
| PK | `SKILL#{skillId}` or `STEERING#{steeringId}` | Partition key |
| SK | `META` or `VERSION#{version}` | Sort key |
| type | String | `skill` or `steering` |
| scope | String | `global` or `agent:{agentName}` |
| targetAgent | String | Agent name (null for global) |
| title | String | Human-readable name |
| description | String | Brief summary |
| s3Key | String | Current version S3 key |
| currentVersion | Number | Latest version number |
| createdBy | String | Team lead identity |
| createdAt | String | ISO-8601 |
| updatedAt | String | ISO-8601 |
| enabled | Boolean | Active or disabled |

**GSI-1:** `scope-type-index` — fetch all global skills, or all docs of a given type within a scope
**GSI-2:** `targetAgent-type-index` — fetch all skills/steering for a given agent quickly

### Document Format

```markdown
---
id: skill-dns-management
type: skill
scope: agent:triage
targetAgent: triage
title: DNS Record Classification
version: 3
enabled: true
---

# DNS Record Classification

When a work item mentions DNS, CNAME, A record, MX record, or name resolution:
- Classify as: account/service request
- Risk level: low (single-system, fully reversible)
- Tag with: dns, network-services

## Context
DNS changes at ODOT are handled through the network team but triaged by server team.
Forward DNS requests mentioning "external" to network team instead of processing.
```

## Prompt Composition at Runtime

When an agent is invoked, the Orchestration context's adapter layer composes the full prompt:

### Composition Order (priority, last wins on conflict)

```
┌─────────────────────────────────────────┐
│ Base Agent System Prompt (hardcoded)    │  ← lowest priority
├─────────────────────────────────────────┤
│ Global Steering Docs                    │
├─────────────────────────────────────────┤
│ Agent-Specific Steering Docs            │
├─────────────────────────────────────────┤
│ Global Skills                           │
├─────────────────────────────────────────┤
│ Agent-Specific Skills                   │  ← highest priority
├─────────────────────────────────────────┤
│ Work Item Context / Research Results    │  ← runtime data
└─────────────────────────────────────────┘
```

### Port Interface

```typescript
interface ISkillSteeringProvider {
  getComposedPromptContext(agentName: string): Promise<PromptContext>;
}

interface PromptContext {
  globalSteering: SteeringDoc[];
  agentSteering: SteeringDoc[];
  globalSkills: SkillDoc[];
  agentSkills: SkillDoc[];
  tokenBudgetUsed: number;
  droppedDocs: string[];  // IDs of docs dropped due to token budget
}

interface SkillDoc {
  id: string;
  title: string;
  version: number;
  content: string;  // Markdown body (frontmatter stripped)
}

interface SteeringDoc {
  id: string;
  title: string;
  version: number;
  content: string;
}
```

### Caching Strategy

- DynamoDB index read on each invocation (fast, indexed query)
- S3 document content cached in Lambda execution context (warm starts benefit)
- No cross-invocation cache — ensures immediate effect on update

## Dashboard API

### New Endpoints

```
GET    /skills                          # List all skills (filterable by scope, agent, enabled)
POST   /skills                          # Create new skill (team_lead only)
GET    /skills/:id                      # Get skill with current content
GET    /skills/:id/versions             # List all versions
GET    /skills/:id/versions/:version    # Get specific version content
PUT    /skills/:id                      # Update skill (creates new version)
DELETE /skills/:id                      # Soft-delete (disable) skill
POST   /skills/:id/rollback/:version   # Rollback to specific version

GET    /steering                        # List all steering docs (filterable)
POST   /steering                        # Create new steering doc (team_lead only)
GET    /steering/:id                    # Get steering doc with current content
GET    /steering/:id/versions           # List all versions
GET    /steering/:id/versions/:version  # Get specific version content
PUT    /steering/:id                    # Update steering doc (creates new version)
DELETE /steering/:id                    # Soft-delete (disable)
POST   /steering/:id/rollback/:version # Rollback to specific version
```

### RBAC

- `team_lead`: full CRUD on skills and steering docs
- `team_member`: read-only (can view skills/steering but not create/edit/delete)

## Dashboard UI

### New Views

1. **Skills Management Page** — list of all skills grouped by scope (global / per-agent). Each shows: title, target agent, enabled/disabled toggle, version number, last updated by/when. Click to edit with a markdown editor.

2. **Steering Management Page** — same layout as skills, but for steering docs.

3. **Agent Detail View** (enhancement to existing module/agent view) — shows which skills and steering docs are active for a given agent, with quick links to edit.

4. **Version History Panel** — on skill/steering detail, shows version timeline with diff view and "rollback to this version" button.

5. **Token Budget Indicator** — shows how much of the agent's context window is consumed by skills/steering, warning when approaching limits.

## Event Integration

### New Events

| Event | Source | Consumers |
|-------|--------|-----------|
| `skill.updated` | Dashboard | Communication, Platform (audit) |
| `steering.updated` | Dashboard | Communication, Platform (audit) |

These are informational only. The Orchestration context reads S3/DynamoDB directly at invocation time (pull model, not push).

### Event Schema

Events follow the existing EventEnvelope standard with payload containing:
- `docId`: skill or steering doc ID
- `docType`: `skill` or `steering`
- `action`: `created`, `updated`, `deleted`, `rolledBack`
- `version`: new version number
- `actorId`: team lead identity
- `targetAgent`: agent name or `global`

## Error Handling

| Scenario | Behavior |
|----------|----------|
| S3 fetch fails during prompt composition | Agent proceeds with base prompt only; logs warning; flags work item as "operating without full skill context" |
| DynamoDB index unavailable | Agent proceeds with base prompt only; same degradation flag |
| Skill/Steering doc is malformed (invalid frontmatter) | Skip that doc; log error; include all other valid docs |
| Total composed prompt exceeds Bedrock model context window | Truncate lowest-priority docs first (global skills → global steering → agent steering → agent skills); log which docs were dropped |
| Rollback to non-existent version | Return 404 with clear error message |
| Create/update with empty content | Return 400 validation error |

### Prompt Size Management

Bedrock models have context window limits. The prompt composer:
1. Calculates total token count of composed context
2. If over budget, drops docs in priority order (global skills first, then global steering, preserving agent-specific last)
3. Logs which docs were dropped for that invocation
4. Exposes token budget usage via API so team leads can see how "full" an agent's prompt is

## Audit Trail Integration

Every skill/steering operation is logged:
- Create, update, delete, rollback, enable, disable
- Actor identity (team lead)
- Timestamp
- Version from/to (for updates and rollbacks)
- Full diff available via version comparison

## Infrastructure

### New Terraform Resources (added to existing contexts)

**Dashboard context (`terraform/contexts/dashboard/`):**
- DynamoDB table: `skills-steering-index` with GSIs
- Additional S3 paths in existing storage bucket (no new bucket needed)
- Additional Lambda handlers for skills/steering CRUD API

**Orchestration context (`terraform/contexts/orchestration/`):**
- IAM permissions for reading skills-steering DynamoDB table and S3 paths
- No new resources — just permissions and adapter code

### Event Schemas (added to contracts)

- `contracts/events/dashboard/skill.updated.schema.json`
- `contracts/events/dashboard/steering.updated.schema.json`
