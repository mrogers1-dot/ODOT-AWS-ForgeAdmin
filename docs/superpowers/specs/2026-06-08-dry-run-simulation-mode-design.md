# Dry-Run / Simulation Mode for Plans — Design Specification

**Date:** 2026-06-08
**Author:** Matt Rogers + Kiro
**Status:** Draft → Pending Approval

---

## 1. Overview

The current ForgeAdmin approval workflow shows operators a list of plan steps with confidence scores and justifications. But operators must mentally simulate "what will this actually change?" before approving. This feature adds a two-tier simulation system — like `terraform plan` for Windows Server operations — that shows projected diffs automatically and offers live state verification on demand.

Tier 1 (Static Analysis) runs on every plan automatically, parsing commands against a registry of known PowerShell cmdlet effects to predict what will change. Tier 2 (Live Probe) is triggered on-demand by the reviewer, connecting to a dedicated read-only JEA endpoint on the jump server to capture actual current state and compare it against the plan's expectations.

## 2. Key Decisions

- **Simulation fidelity:** Hybrid — static analysis by default (fast, cheap, automatic), live probe on-demand (accurate, requires jump server).
- **Architecture:** Both tiers live in the Execution context. It owns command semantics and the jump server bridge.
- **Static analysis trigger:** Automatic on every `plan.proposed` event. Never blocks approval flow (async, arrives via WebSocket).
- **Live probe concurrency:** Isolated via dedicated read-only JEA endpoint with its own mTLS cert. No conflict with real executions.
- **Command knowledge:** JSON registry of known cmdlet effects shipped with platform, extendable via Dashboard.
- **Unknown commands:** Marked as "unpredictable — manual review recommended." Never blocks approval.

## 3. Architecture & Simulation Flow

### 3.1 Two-Tier Design

```
Tier 1: Static Analysis (automatic, every plan)
─────────────────────────────────────────────────
plan.proposed event
  → Execution context: static-analyzer Lambda
  → Parses plan steps, maps commands to predicted changes via command registry
  → Publishes plan.preview-ready event with diff
  → Dashboard displays diff alongside plan in approval queue

Tier 2: Live Probe (on-demand, operator-triggered)
─────────────────────────────────────────────────
Operator clicks "Run Live Probe" in Dashboard
  → Dashboard API → Execution context: live-probe Lambda
  → Connects to jump server READ-ONLY JEA endpoint (separate from write endpoint)
  → Runs Get-*/Test-* commands to capture current state
  → Compares current state against plan's expected pre/post state
  → Publishes plan.probe-completed event with state comparison
  → Dashboard updates approval view with live state data
```

### 3.2 Internal Structure (additions to Execution context)

```
src/contexts/execution/
├── domain/
│   ├── ports/
│   │   ├── IDryRunProvider.ts        # Static analysis + live probe interfaces
│   │   └── ICommandRegistry.ts       # Command → predicted effect mappings
│   ├── models/
│   │   ├── simulation-result.ts      # Predicted diff, state comparison
│   │   └── command-effect.ts         # What a command changes
│   └── simulation/
│       ├── static-analyzer.ts        # Parses plan steps, generates predicted diffs
│       ├── live-prober.ts            # Runs read-only commands, builds state snapshot
│       └── diff-generator.ts         # Compares predicted/current/expected states
├── adapters/
│   ├── command-registry.ts           # JSON registry of known cmdlet effects
│   └── readonly-bridge.ts           # mTLS connection to read-only JEA endpoint
├── handlers/
│   ├── on-plan-proposed.ts          # EventBridge trigger → static analysis
│   └── live-probe-handler.ts        # API Gateway trigger → on-demand probe
```

### 3.3 Event Flow

```
Current:  plan.proposed → Dashboard (approval queue)

Enhanced: plan.proposed → Dashboard (approval queue, shows "Generating preview...")
                       → Execution (static-analyzer)
                           → plan.preview-ready → Dashboard (updates with diff via WebSocket)

On-demand: Dashboard API → Execution (live-probe-handler)
                             → plan.probe-completed → Dashboard (updates with live state)
```

**Key Principle:** Static analysis never blocks the approval flow. The plan appears in the approval queue immediately. The preview arrives asynchronously (typically <2 seconds) and the UI updates in-place via WebSocket.

## 4. Command Registry & Static Analysis

### 4.1 Command Effect Model

```typescript
interface CommandEffect {
  cmdlet: string;                       // "Set-ADAccountPassword"
  category: string;                     // "active-directory", "dns", "file-system", etc.

  targets: {
    objectType: string;                 // "AD User", "DNS Record", "Service", etc.
    identifiedBy: string;              // Which parameter identifies the target
    attributes: AttributeEffect[];
  }[];

  probeCommands: {
    before: string;                     // "Get-ADUser -Identity {Identity} -Properties *"
    after: string;                      // Same — compare before/after
    relevantAttributes: string[];      // Which attributes to diff
  };

  reversible: boolean;
  scope: 'single-object' | 'multi-object' | 'environment-wide';
}

interface AttributeEffect {
  attribute: string;                    // "PasswordLastSet"
  changeType: 'set' | 'clear' | 'append' | 'remove' | 'toggle';
  valueSource: 'parameter' | 'computed' | 'system-generated';
  parameterName?: string;              // Which cmdlet parameter provides the new value
}
```

### 4.2 Registry Storage

- JSON files in repo: `contracts/command-registry/{category}/{cmdlet}.json`
- Loaded at Lambda cold start, cached in execution context
- Team leads can add new command definitions via Dashboard (code-defaults + Dashboard-overrides pattern)
- Unknown commands: step marked as "unpredictable — manual review recommended"

### 4.3 Default Registry (shipped with platform)

| Category | Cmdlets Covered | Example |
|----------|----------------|---------|
| Active Directory | Set-ADAccountPassword, Set-ADUser, Enable-ADAccount, Disable-ADAccount, Unlock-ADAccount, Move-ADObject | Changes password attribute on target user |
| DNS | Add-DnsServerResourceRecord, Remove-DnsServerResourceRecord, Set-DnsServerResourceRecord | Adds A record for {Name} → {IPv4Address} in zone {ZoneName} |
| Services | Set-Service, Start-Service, Stop-Service, Restart-Service | Changes StartType on {Name} service |
| File System | Copy-Item, Remove-Item, New-Item, Set-Content | Creates/modifies file at {Path} |
| Group Policy | Set-GPRegistryValue, Remove-GPRegistryValue | Modifies registry value in GPO |
| Networking | Set-NetIPAddress, New-NetFirewallRule, Remove-NetFirewallRule | Adds firewall rule allowing {Protocol} on {LocalPort} |

### 4.4 Static Analysis Output

```typescript
interface SimulationResult {
  planId: string;
  type: 'static' | 'live-probe';
  timestamp: string;

  steps: StepPreview[];

  summary: {
    totalSteps: number;
    predictableSteps: number;
    unpredictableSteps: number;
    totalChanges: number;
    riskAssessment: 'low' | 'medium' | 'high';
  };
}

interface StepPreview {
  stepNumber: number;
  command: string;
  predictable: boolean;

  predictedChanges: PredictedChange[];

  currentState?: Record<string, any>;  // Live probe only
  warnings?: string[];
}

interface PredictedChange {
  target: string;                      // "CN=jsmith,OU=finance,DC=odot,DC=ohio,DC=gov"
  objectType: string;                  // "AD User"
  attribute: string;                   // "PasswordLastSet"
  changeType: string;                  // "set"
  currentValue?: string;              // Only populated by live probe
  newValue: string | 'system-generated';
  reversible: boolean;
}
```

## 5. Live Probe — Read-Only JEA Endpoint

### 5.1 JEA Configuration

```powershell
# ForgeAdmin-ReadOnly.pssc (Session Configuration)
@{
    SessionType = 'RestrictedRemoteServer'
    RunAsVirtualAccount = $true
    VisibleCmdlets = @(
        'Get-ADUser', 'Get-ADComputer', 'Get-ADGroup', 'Get-ADObject',
        'Get-DnsServerResourceRecord', 'Get-DnsServerZone',
        'Get-Service', 'Get-Process',
        'Get-Item', 'Get-ChildItem', 'Get-Content',
        'Get-NetIPAddress', 'Get-NetFirewallRule',
        'Test-Connection', 'Test-Path', 'Test-NetConnection',
        'Resolve-DnsName'
    )
    LanguageMode = 'NoLanguage'
}
```

### 5.2 Isolation from Execution

| Aspect | Execution (Write) | Probe (Read-Only) |
|--------|-------------------|-------------------|
| JEA Endpoint | ForgeAdmin-Execute | ForgeAdmin-ReadOnly |
| Service Account | svc-forgeadmin-exec | svc-forgeadmin-probe |
| mTLS Certificate | exec-cert (Secrets Manager) | probe-cert (Secrets Manager) |
| Permitted Cmdlets | Set-*, Add-*, Remove-*, etc. | Get-*, Test-*, Resolve-* only |
| Concurrency | Max 1 (SQS enforced) | Unlimited (read-only is safe) |
| Language Mode | ConstrainedLanguage | NoLanguage |

### 5.3 Probe Flow

```
1. Operator clicks "Run Live Probe" on pending approval
2. Dashboard API → POST /plans/:id/probe
3. live-probe Lambda loads plan steps + command registry
4. For each step:
   a. Look up probeCommands from registry
   b. Connect to read-only JEA endpoint via mTLS
   c. Execute Get-*/Test-* commands
   d. Capture current state of target objects
5. Diff-generator compares: current state vs plan's expected pre-state
6. Publish plan.probe-completed event
7. Dashboard updates via WebSocket
```

## 6. Dashboard UI Enhancement

### 6.1 Approval Queue — With Preview

```
┌─────────────────────────────────────────────────────────────────────┐
│ Plan #247: Reset password for jsmith (AD Account/Service Request)   │
│ Confidence: 72 | Risk: Low | Module: ad-management                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ Steps:                          │ Predicted Changes (Static):       │
│ 1. Unlock-ADAccount             │ ┌────────────────────────────┐   │
│ 2. Set-ADAccountPassword        │ │ CN=jsmith,OU=finance       │   │
│ 3. Set-ADUser -ChangePassword.. │ │  ├ LockedOut: True → False │   │
│                                 │ │  ├ PasswordLastSet: → Now  │   │
│                                 │ │  └ pwdLastSet: → Now       │   │
│                                 │ │ ChangePasswordAtLogon: Yes │   │
│                                 │ └────────────────────────────┘   │
│                                 │                                   │
│                                 │ [✓ 3/3 steps predictable]        │
│                                 │ [Risk: Low — single object,      │
│                                 │  all reversible]                  │
├─────────────────────────────────────────────────────────────────────┤
│ [Run Live Probe]  [Approve]  [Reject]                               │
└─────────────────────────────────────────────────────────────────────┘
```

### 6.2 After Live Probe

```
│ Live State Verification:                                            │
│ ┌──────────────────────────────────────────┐                       │
│ │ CN=jsmith,OU=finance — CONFIRMED EXISTS  │                       │
│ │  ├ LockedOut: True ✓ (matches expected)  │                       │
│ │  ├ Enabled: True ✓                       │                       │
│ │  └ Last probe: 5 seconds ago             │                       │
│ └──────────────────────────────────────────┘                       │
│ [✓ Target verified — ready for execution]                          │
```

### 6.3 New API Endpoints

```
POST   /plans/:id/probe              # Trigger live probe (team_lead + admin)
GET    /plans/:id/preview            # Get static analysis result
GET    /plans/:id/probe-result       # Get live probe result
```

**RBAC:** Both `team_lead` and `admin` can trigger probes. `team_member` can view preview/probe results (read-only).

## 7. Error Handling

| Scenario | Behavior |
|----------|----------|
| Static analysis: unknown command (not in registry) | Mark step as "unpredictable — manual review recommended." Show known steps normally. |
| Static analysis: plan parsing fails | Publish preview with `predictableSteps = 0`, warning: "Could not analyze plan structure." Approval still available. |
| Live probe: read-only endpoint unreachable | Return error to Dashboard: "Probe unavailable — jump server read endpoint not responding." Approval still available. |
| Live probe: target object not found | Warning on step: "Target CN=jsmith not found in directory. Verify plan target." |
| Live probe: timeout (30 seconds) | Return partial results for completed steps. Mark remaining as "timed out." |
| Live probe: concurrent request for same plan | Reject with 409 Conflict: "Probe already in progress." |
| Static analysis Lambda fails | Plan appears in approval queue without preview. Logs error. DLQ retry. |
| Command registry file malformed | Skip that cmdlet, log error. Other cmdlets still work. |

**Graceful Degradation:**
1. Full operation: static preview + live probe available
2. Partial: static preview available, jump server unreachable (probe unavailable)
3. Minimal: static analysis failed — plan still in approval queue with no preview
4. Approval is NEVER blocked by simulation failure

## 8. New Event Schemas

```
contracts/events/execution/plan.preview-ready.schema.json
contracts/events/execution/plan.probe-completed.schema.json
```

**`plan.preview-ready`:**

```json
{
  "source": "forgeadmin.execution",
  "detail-type": "plan.preview-ready",
  "detail": {
    "version": "1.0",
    "correlationId": "uuid",
    "timestamp": "ISO-8601",
    "payload": {
      "planId": "uuid",
      "type": "static",
      "summary": {
        "totalSteps": 3,
        "predictableSteps": 3,
        "unpredictableSteps": 0,
        "totalChanges": 3,
        "riskAssessment": "low"
      },
      "steps": []
    }
  }
}
```

**`plan.probe-completed`:**

```json
{
  "source": "forgeadmin.execution",
  "detail-type": "plan.probe-completed",
  "detail": {
    "version": "1.0",
    "correlationId": "uuid",
    "timestamp": "ISO-8601",
    "payload": {
      "planId": "uuid",
      "type": "live-probe",
      "probeStatus": "completed | partial | failed",
      "summary": {
        "totalSteps": 3,
        "stepsProbed": 3,
        "stateMatchesExpected": true,
        "warnings": []
      },
      "steps": []
    }
  }
}
```

## 9. Infrastructure

### 9.1 Execution Context (additions)

- New Lambda: `static-analyzer` (EventBridge trigger on `plan.proposed`)
- New Lambda: `live-probe-handler` (API Gateway trigger)
- New Secrets Manager entry: read-only JEA endpoint mTLS certificate
- New IAM permissions: read-only bridge access
- Command registry JSON: `contracts/command-registry/{category}/{cmdlet}.json`

### 9.2 Dashboard Context (additions)

- New API endpoints: `/plans/:id/probe`, `/plans/:id/preview`, `/plans/:id/probe-result`
- Enhanced approval queue UI with preview panel and probe button
- WebSocket subscription to `plan.preview-ready` and `plan.probe-completed` events

### 9.3 Jump Server (additions)

- New JEA endpoint: `ForgeAdmin-ReadOnly`
- New service account: `svc-forgeadmin-probe` (read-only AD/DNS/service permissions)
- New mTLS certificate for probe connections

## 10. Testing Strategy

### 10.1 Testing Pyramid

| Level | What | Approach |
|-------|------|----------|
| Unit | Static analyzer command parsing, diff generation, registry lookup | Vitest |
| Property | Every plan step produces exactly one StepPreview (no loss/duplication) | fast-check |
| Property | Unknown commands never block analysis (graceful degradation) | fast-check |
| Contract | Event schemas for preview-ready, probe-completed | JSON Schema validation |
| Integration | Full flow: plan.proposed → static analysis → preview-ready | LocalStack |

### 10.2 Property Tests

| Property | Description |
|----------|-------------|
| Step completeness | Every plan step produces exactly one StepPreview entry |
| Graceful unknowns | Plans with unknown commands still produce a valid SimulationResult |
| Registry consistency | Every command in registry has both write cmdlet and corresponding probe commands |

## 11. Execution Order

| Task | Wave | Description |
|------|------|-------------|
| Command registry JSON structure + initial cmdlets | 4 | Data foundation |
| IDryRunProvider port + simulation models | 4 | Interfaces |
| Static analyzer domain logic | 5 | Core prediction engine |
| on-plan-proposed handler (auto static) | 6 | Wiring |
| Read-only bridge adapter | 6 | mTLS to read-only JEA endpoint |
| Live probe handler + diff generator | 7 | On-demand probe |
| Dashboard UI enhancements (preview + probe) | 9 | Frontend |
| Property tests | 7 | Correctness validation |

## 12. Relationship to Other Enhancement Specs

- **Spec 2 (Feedback Loop):** After execution, the actual state change is compared against the static prediction. Prediction accuracy feeds into the feedback loop — over time, you can track "how accurate are our static predictions?" and improve the command registry.
- **Spec 4 (Confidence Calibration):** Simulation results (predicted vs actual) contribute to calibration data. Plans where static analysis predicted correctly can have higher confidence weight.
- **Spec 1 (Incident Correlation):** Correlated groups that produce a merged parent plan get a single simulation result for the combined plan.
