# Task Group 14: Dry-Run / Simulation Mode

**Bounded Context:** Execution Layer (simulation logic) + Dashboard (UI enhancements)
**Internal Pattern:** Hexagonal (ports/adapters) — extends existing Execution context
**Dependencies:** Task Group 01 (foundation), Task Group 04 (Orchestration publishes `plan.proposed`), Task Group 06 (Execution mTLS bridge infrastructure)
**Design Spec:** `docs/superpowers/specs/2026-06-08-dry-run-simulation-mode-design.md`

---

## Tasks

- [ ] 15.1 Create command registry structure and initial cmdlet definitions
  - Create `contracts/command-registry/schema.json`: JSON Schema for CommandEffect validation
  - Create `contracts/command-registry/active-directory/Set-ADAccountPassword.json`: targets AD User, attributes PasswordLastSet, probeCommands using Get-ADUser
  - Create `contracts/command-registry/active-directory/Set-ADUser.json`: targets AD User, configurable attributes, probeCommands
  - Create `contracts/command-registry/active-directory/Enable-ADAccount.json`: targets AD User, Enabled attribute
  - Create `contracts/command-registry/active-directory/Disable-ADAccount.json`: targets AD User, Enabled attribute
  - Create `contracts/command-registry/active-directory/Unlock-ADAccount.json`: targets AD User, LockedOut attribute
  - Create `contracts/command-registry/active-directory/Move-ADObject.json`: targets AD Object, DistinguishedName attribute
  - Create `contracts/command-registry/dns/Add-DnsServerResourceRecord.json`: targets DNS Record, adds record
  - Create `contracts/command-registry/dns/Remove-DnsServerResourceRecord.json`: targets DNS Record, removes record
  - Create `contracts/command-registry/dns/Set-DnsServerResourceRecord.json`: targets DNS Record, modifies record
  - Create `contracts/command-registry/services/Set-Service.json`: targets Service, StartType attribute
  - Create `contracts/command-registry/services/Start-Service.json`: targets Service, Status attribute
  - Create `contracts/command-registry/services/Stop-Service.json`: targets Service, Status attribute
  - Create `contracts/command-registry/services/Restart-Service.json`: targets Service, Status attribute
  - Create `contracts/command-registry/file-system/Copy-Item.json`, `Remove-Item.json`, `New-Item.json`, `Set-Content.json`
  - Create `contracts/command-registry/group-policy/Set-GPRegistryValue.json`, `Remove-GPRegistryValue.json`
  - Create `contracts/command-registry/networking/Set-NetIPAddress.json`, `New-NetFirewallRule.json`, `Remove-NetFirewallRule.json`
  - _Design Spec: Sections 4.2, 4.3_

- [ ] 15.2 Add simulation infrastructure to Execution Terraform module
  - Modify `terraform/contexts/execution/lambda.tf`: add `static-analyzer` Lambda (EventBridge trigger on `plan.proposed`), `live-probe-handler` Lambda (API Gateway trigger)
  - Modify `terraform/contexts/execution/eventbridge.tf`: add rule subscribing to `plan.proposed` event, routing to static-analyzer
  - Modify `terraform/contexts/execution/api-gateway.tf`: add `/plans/{planId}/probe` POST endpoint for live probe
  - Modify `terraform/contexts/execution/secrets.tf`: add read-only JEA endpoint mTLS certificate in Secrets Manager
  - Modify `terraform/contexts/execution/iam.tf`: static-analyzer Lambda role (EventBridge publish), live-probe Lambda role (Secrets Manager read, Transit Gateway access for read-only endpoint)
  - _Design Spec: Sections 9.1_

- [ ] 15.3 Define event schemas for simulation
  - Create `contracts/events/execution/plan.preview-ready.schema.json`: static analysis complete (planId, type=static, summary with totalSteps/predictableSteps/unpredictableSteps/totalChanges/riskAssessment, steps array)
  - Create `contracts/events/execution/plan.probe-completed.schema.json`: live probe results (planId, type=live-probe, probeStatus, summary with stepsProbed/stateMatchesExpected/warnings, steps array)
  - Validate schemas conform to EventEnvelope standard
  - Register schemas in EventBridge Schema Registry
  - _Design Spec: Section 8_

- [ ] 15.4 Implement simulation domain models and ports
  - Create `src/contexts/execution/domain/ports/IDryRunProvider.ts`: interface with `analyzeStatically(plan)` and `probeLive(plan)` methods
  - Create `src/contexts/execution/domain/ports/ICommandRegistry.ts`: interface with `getEffect(cmdlet)` returning CommandEffect or null
  - Create `src/contexts/execution/domain/models/simulation-result.ts`: SimulationResult, StepPreview, PredictedChange interfaces
  - Create `src/contexts/execution/domain/models/command-effect.ts`: CommandEffect, AttributeEffect interfaces matching registry schema
  - _Design Spec: Sections 3.2, 4.1, 4.4_

- [ ] 15.5 Implement static analyzer
  - **RED**: Write tests: (1) known command produces PredictedChange with target/attribute/changeType, (2) unknown command marks step as predictable=false with warning, (3) summary correctly counts predictable vs unpredictable steps, (4) parse failure marks step as unpredictable and continues, (5) risk assessment accounts for reversibility
  - **GREEN**: Create `src/contexts/execution/domain/simulation/static-analyzer.ts`. Parse plan steps, look up in ICommandRegistry, generate predictions for known commands, mark unknown as unpredictable. Calculate summary.
  - **REFACTOR**: Extract command parsing into testable utility; ensure summary calculation is deterministic
  - _Design Spec: Sections 4.4_

- [ ] 15.6 Implement command registry adapter
  - **RED**: Write tests: (1) known cmdlet returns CommandEffect, (2) unknown cmdlet returns null, (3) malformed registry file is skipped with error logged, (4) Dashboard overrides take precedence over JSON files, (5) warm start uses cached registry
  - **GREEN**: Create `src/contexts/execution/adapters/command-registry.ts`: implements ICommandRegistry. Load JSON files at cold start, cache in execution context. Return effect for known, null for unknown. Support Dashboard overrides.
  - **REFACTOR**: Ensure cache invalidation on Dashboard override change; validate all registry files on load
  - _Design Spec: Sections 4.2_

- [ ] 15.7 Implement diff generator
  - Create `src/contexts/execution/domain/simulation/diff-generator.ts`
  - For static analysis: generates diffs from predicted changes only
  - For live probe: compares captured current state against expected pre-state from plan
  - Output: unified diff format showing attribute → new value (static) or current value → expected value (live)
  - Handle missing attributes in live probe: report as warning "attribute not found on target"
  - _Design Spec: Sections 3.2_

- [ ] 15.8 Implement live prober
  - **RED**: Write tests: (1) known command probe executes read-only commands on bridge, (2) state mismatch generates warning, (3) 30-second timeout returns partial results, (4) unknown commands are skipped, (5) target not found generates warning
  - **GREEN**: Create `src/contexts/execution/domain/simulation/live-prober.ts`. Look up probeCommands from registry. Execute via read-only bridge. Parse output. Compare against expected state. Generate warnings for mismatches.
  - **REFACTOR**: Extract state comparison logic; ensure timeout handling returns whatever is already collected
  - _Design Spec: Sections 5.1, 5.3_

- [ ] 15.9 Implement read-only bridge adapter
  - Create `src/contexts/execution/adapters/readonly-bridge.ts`
  - mTLS connection to dedicated read-only JEA endpoint on jump server (separate from execution endpoint)
  - Load probe mTLS certificate from Secrets Manager
  - Submit read-only commands (Get-*, Test-*, Resolve-* only)
  - Parse PowerShell output to structured JSON
  - Handle connection failures gracefully: return error result, never throw
  - Implement 30-second per-probe timeout
  - _Design Spec: Sections 5.1, 5.2_

- [ ] 15.10 Implement simulation Lambda handlers
  - Create `src/contexts/execution/handlers/on-plan-proposed.ts`: EventBridge trigger on `plan.proposed`, wires static-analyzer, publishes `plan.preview-ready` event. Must complete within 10 seconds (fast path).
  - Create `src/contexts/execution/handlers/live-probe-handler.ts`: API Gateway trigger (POST /plans/:id/probe), wires live-prober + readonly-bridge, publishes `plan.probe-completed` event. 30-second timeout.
  - Handle concurrent probe requests for same plan: reject with 409 Conflict
  - Apply structured logging with correlationId and X-Ray tracing
  - _Design Spec: Sections 3.1, 7_

- [ ] 15.11 Implement Dashboard API endpoints for simulation
  - Modify `src/contexts/dashboard/api/handlers/approvals.ts`: add POST /plans/:id/probe (proxies to Execution context via EventBridge or direct invocation), GET /plans/:id/preview (returns stored static analysis), GET /plans/:id/probe-result (returns stored live probe)
  - Implement RBAC: team_lead + admin can trigger probes, team_member can view results
  - Store simulation results in Dashboard DynamoDB (attached to plan/approval record)
  - _Design Spec: Section 6.3_

- [ ] 15.12 Implement Dashboard UI for simulation preview
  - Enhance approval queue view: show "Generating preview..." spinner on new plans, replace with predicted changes panel when `plan.preview-ready` arrives via WebSocket
  - Create Predicted Changes panel: per-step display of target, attribute, current → new value, reversibility indicator, risk badge
  - Create summary bar: X/Y steps predictable, total changes, risk assessment
  - Create "Run Live Probe" button (visible to team_lead + admin only)
  - Create Live State Verification panel: shown after probe completes, per-step current state with match/mismatch indicators
  - Handle unknown commands display: yellow "Manual review" badge on unpredictable steps
  - Add WebSocket subscriptions for `plan.preview-ready` and `plan.probe-completed` events
  - Add Zustand store slice: `simulation` with previews and probe results per planId
  - _Design Spec: Sections 6.1, 6.2_

- [ ] 15.13 Write property tests for simulation
  - **RED**: Write fast-check property tests: (1) Step completeness — every plan step produces exactly one StepPreview entry, (2) Graceful unknowns — plans with unknown commands still produce valid SimulationResult, (3) Registry consistency — every command in registry has both write cmdlet and probe commands
  - **GREEN**: Implement generators for plan step sequences and registry entries; run property tests and fix violations
  - **REFACTOR**: Add generators for mixed known/unknown command plans; validate no data loss
  - _Design Spec: Section 10.2_

---

## Wave Assignment

| Task | Wave |
|------|------|
| 15.1 | 4 |
| 15.2, 15.3 | 5 |
| 15.4, 15.5, 15.6, 15.7 | 5 |
| 15.8, 15.9, 15.10 | 6 |
| 15.11, 15.13 | 7 |
| 15.12 | 9 |

---

## Jump Server Prerequisites

The following on-prem configuration is required before live probe can function:

- **ForgeAdmin-ReadOnly JEA endpoint:** Session configuration with VisibleCmdlets restricted to Get-*, Test-*, Resolve-* commands, NoLanguage mode, RunAsVirtualAccount
- **Service account:** `svc-forgeadmin-probe` with read-only AD/DNS/service/file-system permissions
- **mTLS certificate:** Issued for probe connections, stored in AWS Secrets Manager, separate from execution cert
- **Network:** Transit Gateway route for read-only endpoint (can share existing Transit Gateway attachment)

Static analysis (Tier 1) works independently of jump server setup. Live probe (Tier 2) requires the above infrastructure.
