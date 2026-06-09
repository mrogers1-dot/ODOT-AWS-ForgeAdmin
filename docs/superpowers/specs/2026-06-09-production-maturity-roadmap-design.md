# ForgeAdmin Production Maturity Roadmap — Design Specification

**Date:** 2026-06-09
**Author:** Matt Rogers + Kiro
**Status:** Draft → Pending Approval

---

## 1. Overview

This roadmap takes ForgeAdmin from "code complete in a repository" to "autonomously handling low-risk tickets in production with human approval gates." It prioritizes quick wins and MVP-first delivery, structured so the team sees value within the first 2 weeks and progressively gains confidence in the system.

The key insight: the on-prem execution bridge (Transit Gateway + jump server) has the longest lead time due to cross-team network dependencies. The roadmap exploits ForgeAdmin's event-driven architecture to prove 80% of the platform's value (ingestion, triage, research, planning, knowledge base growth) while the bridge is being built in parallel.

---

## 2. Current State

| Dimension | Status |
|-----------|--------|
| Application code | Complete — 285 tests, 51 test files, 12 property tests, 6 integration tests |
| Terraform modules | Written and validated (`terraform validate` passes on all 9 modules) |
| AWS deployment | Nothing deployed — no Terraform state exists |
| On-prem jump server | Not provisioned |
| Transit Gateway routing | Not requested — requires network team involvement |
| Bedrock model access | Not configured |
| ServiceNow integration | Not connected (read-only access needed) |
| Teams/Slack integration | Not configured |
| Team Cognito accounts | Not created |

---

## 3. Phase Structure

```
Phase 1: "Lights On"         (Week 1-2)    — Foundation + Dashboard visible
Phase 2: "Brain Online"      (Week 2-4)    — AI triage/planning in shadow mode
Phase 3: "Bridge Building"   (Week 3-8)    — On-prem execution path (parallel)
Phase 4: "Go Live"           (Week 6-10)   — Promote modules, validate POC
```

Phases 2 and 3 overlap intentionally. Phase 3 starts its longest-lead-time item (Transit Gateway request) on Day 1, then proceeds with server work while Phase 2 delivers the AI brain.

---

## 4. Phase 1 — "Lights On" (Week 1-2)

**Goal:** Team can log into the Dashboard, see the platform, verify CI/CD works end-to-end.

**Why this is a quick win:** Proves the infrastructure pipeline works. The team has something tangible to look at within days. Unblocks all subsequent phases.

### 4.1 Prerequisites (Day 1)

| Task | Owner | Notes |
|------|-------|-------|
| AWS account access confirmed | You | IAM permissions for: Lambda, EventBridge, DynamoDB, S3, Cognito, API Gateway, Step Functions, CloudWatch, X-Ray, SNS, SES, VPC, Bedrock, CloudFront, Secrets Manager |
| AWS CLI v2 configured locally | You | Profile with deploy role |
| Terraform >= 1.6 installed | You | Matches CI/CD version |
| GitHub repository secrets configured | You | `AWS_DEPLOY_ROLE_ARN`, `TF_STATE_BUCKET`, `TF_STATE_LOCK_TABLE` |

### 4.2 Bootstrap Terraform State Backend (Day 1)

Before any `terraform apply` can run, the state backend must exist. This is a chicken-and-egg problem — the state bucket can't be managed by Terraform if it doesn't exist yet.

```bash
# One-time manual bootstrap (not managed by Terraform)
aws s3 mb s3://forgeadmin-terraform-state --region us-east-2
aws s3api put-bucket-versioning \
  --bucket forgeadmin-terraform-state \
  --versioning-configuration Status=Enabled

aws dynamodb create-table \
  --table-name forgeadmin-terraform-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-2
```

### 4.3 Deploy Foundation (Day 1-2)

```bash
cd terraform/foundation
terraform init
terraform plan -var-file=../environments/dev.tfvars
terraform apply -var-file=../environments/dev.tfvars
```

This deploys:
- EventBridge custom bus (`forgeadmin-events`)
- VPC with private/public subnets (Transit Gateway attachment created but not yet routed)
- Cognito User Pool with `team_lead` and `team_member` groups
- Shared IAM roles
- SSM parameters for cross-context discovery

### 4.4 Create Team Accounts (Day 2)

Create Cognito users for the server team:
- At least 2 `team_lead` accounts (for approval chain testing)
- At least 2 `team_member` accounts
- Update `cognito_callback_urls` in `dev.tfvars` to include the deployed CloudFront domain once known

### 4.5 Deploy Dashboard + Platform Contexts (Day 2-3)

```bash
cd terraform/contexts/platform
terraform init
terraform apply -var-file=../../environments/dev.tfvars

cd ../dashboard
terraform init
terraform apply -var-file=../../environments/dev.tfvars
```

This deploys:
- Dashboard: CloudFront + S3 (React SPA), API Gateway, WebSocket API, DynamoDB tables
- Platform: Audit trail DynamoDB, S3 archival bucket, CloudWatch dashboards, DLQ monitors

### 4.6 Build and Deploy Frontend (Day 3)

```bash
cd src/contexts/dashboard/frontend
pnpm build
aws s3 sync dist/ s3://forgeadmin-dashboard-{env}/ --delete
aws cloudfront create-invalidation --distribution-id {dist-id} --paths "/*"
```

### 4.7 Verify CI/CD Pipeline (Day 3-4)

- Push a trivial change to `main` on the `terraform/` path
- Confirm GitHub Actions `terraform-deploy.yml` triggers, plans, and applies
- Confirm `pr-checks.yml` runs lint, typecheck, tests, contract validation, and terraform validate on a PR

### 4.8 Phase 1 Exit Criteria

- [ ] Team members can log into Dashboard via Cognito
- [ ] Dashboard shows empty module list (all modules in "disabled" state)
- [ ] CloudWatch dashboards are accessible and showing platform context metrics
- [ ] CI/CD pipeline executes successfully on push to main
- [ ] Audit trail DynamoDB table exists and accepts writes
- [ ] WebSocket connection establishes from browser to API Gateway

---

## 5. Phase 2 — "Brain Online" (Week 2-4)

**Goal:** Real incidents flow through ForgeAdmin's AI pipeline in shadow mode. Team sees proposals on the Dashboard and evaluates AI quality.

**Why this is MVP:** This proves the core value proposition — AI-powered triage, research, and planning — without any execution risk. The team can evaluate whether ForgeAdmin's proposals are correct and useful before it touches anything.

### 5.1 Deploy Remaining Cloud Contexts (Week 2)

```bash
# Deploy in parallel (no interdependencies beyond foundation)
cd terraform/contexts/ingestion
terraform init && terraform apply -var-file=../../environments/dev.tfvars

cd ../orchestration
terraform init && terraform apply -var-file=../../environments/dev.tfvars

cd ../knowledge-base
terraform init && terraform apply -var-file=../../environments/dev.tfvars

cd ../communication
terraform init && terraform apply -var-file=../../environments/dev.tfvars
```

Or use the full deployment script (contexts deploy in parallel):
```bash
./terraform/scripts/deploy-all.sh dev
```

### 5.2 Configure Bedrock Model Access (Week 2)

| Model | Purpose | Required Access |
|-------|---------|-----------------|
| Claude (Anthropic) | Agent reasoning (triage, research, planning, verification) | Bedrock model access request |
| Titan Embeddings | Knowledge Base vector embeddings | Bedrock model access request |

- Request model access in the AWS Console (Bedrock → Model access)
- Verify the Orchestration context Lambda role has `bedrock:InvokeModel` permission
- Verify the Knowledge Base context has `bedrock:InvokeModel` for Titan embeddings

### 5.3 Seed Knowledge Base (Week 2)

Upload existing team runbooks and documentation to the KB S3 bucket:

```bash
# Upload existing runbooks in markdown format
aws s3 sync ./seed-runbooks/ s3://forgeadmin-knowledge-base-{env}/knowledge-base/

# Trigger Bedrock KB sync (re-index)
aws bedrock-agent start-ingestion-job \
  --knowledge-base-id {kb-id} \
  --data-source-id {ds-id}
```

**What to seed:**
- Existing AD account management runbooks (unlock, enable, password reset)
- Service restart procedures
- Health check remediation steps
- Any tribal knowledge docs the team has in SharePoint/OneNote/wikis

The more you seed, the better the Research Agent's proposals will be from day one.

### 5.4 Connect ServiceNow (Read-Only) (Week 2-3)

The ServiceNow poller needs:
- API endpoint URL
- Service account credentials (stored in Secrets Manager)
- Read-only access to incident records (filter by assignment group = Windows Server team)

Configure the poller's SSM parameters:
- `/forgeadmin/ingestion/servicenow-url`
- `/forgeadmin/ingestion/servicenow-secret-arn` (Secrets Manager ARN for credentials)
- `/forgeadmin/ingestion/servicenow-poll-interval` (default: 60 seconds)
- `/forgeadmin/ingestion/servicenow-filter` (assignment group filter)

### 5.5 Configure Teams/Slack Integration (Week 2-3)

Set up the webhook for notifications:
- Create an incoming webhook in Teams/Slack
- Store webhook URL in Secrets Manager
- Configure SSM parameter: `/forgeadmin/communication/webhook-url`
- Verify morning digest schedule (EventBridge rule: 7:00 AM ET)

### 5.6 Enable Shadow Mode for All Modules (Week 3)

Via the Dashboard:
1. Navigate to module management
2. Set all modules to "Shadow" state
3. Verify `module.state-changed` events appear in audit trail

In shadow mode:
- Incidents are ingested and triaged normally
- Research and planning run against real data
- Proposals are generated with confidence scores
- **Nothing executes** — proposed actions are logged for review
- Shadow records are retained for 30 days

### 5.7 Monitor and Evaluate (Week 3-4)

With real incidents flowing:

| What to Evaluate | Where to Look | Success Signal |
|-----------------|---------------|----------------|
| Triage accuracy | Dashboard → module metrics | Correct category/risk/urgency for majority of tickets |
| Research relevance | Shadow records → knowledge items | Runbooks found match the actual resolution approach |
| Plan quality | Dashboard → pending proposals | Steps are sensible, rollbacks defined, no hallucination |
| Confidence calibration | Confidence scores vs human judgment | High-confidence proposals are actually correct |
| Knowledge gaps | KB gap tracker | System identifies where documentation is missing |

### 5.8 Phase 2 Exit Criteria

- [ ] Real ServiceNow incidents are being ingested (verify in DynamoDB + audit trail)
- [ ] Triage Agent correctly classifies at least 70% of incidents (manual review)
- [ ] Research Agent returns relevant knowledge items (relevance scores > 0.3 for known topics)
- [ ] Planning Agent generates sensible execution plans with confidence scores
- [ ] Morning digest arrives in Teams/Slack at 7:00 AM ET
- [ ] Dashboard shows real-time updates via WebSocket (proposals appearing live)
- [ ] Shadow mode records are visible and reviewable
- [ ] At least 10 incidents have flowed through the full shadow pipeline

---

## 6. Phase 3 — "Bridge Building" (Week 3-8, Parallel)

**Goal:** Establish the on-prem execution path. This runs in parallel with Phase 2.

**Why it starts early:** The Transit Gateway routing request to the network team is the single longest-lead-time item. Starting it on Week 3 Day 1 means it's cooking while you evaluate the AI brain.

### 6.1 Network Request — Day 1 of Phase 3 (CRITICAL PATH)

Submit the Transit Gateway routing request to the network team immediately:

| Request Details | Value |
|-----------------|-------|
| Source | ForgeAdmin VPC (10.0.0.0/16, private subnets) |
| Destination | Jump server IP/subnet (on-prem) |
| Protocol | HTTPS (TCP 443) — mTLS |
| Direction | Bidirectional (Lambda → Jump Server, Jump Server → API Gateway callback) |
| Justification | ForgeAdmin POC — automated IT operations with sandboxed execution |
| Security review | All commands constrained by JEA; MXC sandbox evaluation before execution |

**Estimated lead time:** 2-4 weeks depending on network team backlog and security review.

### 6.2 Provision Jump Server (Week 3-4, parallel with network request)

While waiting for Transit Gateway routing:

| Task | Details |
|------|---------|
| Provision Windows Server | Server 2022, domain-joined, dedicated to ForgeAdmin |
| Harden baseline | CIS benchmark, disable unnecessary services, restrict RDP access |
| Install PowerShell 7.x | Required for modern JEA endpoints |
| Configure Windows Firewall | Allow inbound HTTPS (443) from Transit Gateway CIDR only |
| Install SSL certificate | For mTLS (generate CA, server cert, client cert) |
| Configure audit logging | Windows Event Forwarding to centralized SIEM |

### 6.3 Configure JEA Constrained Endpoints (Week 4-5)

Create JEA session configurations for the POC command set:

**AD Account Management:**
- `Unlock-ADAccount` — unlock locked accounts
- `Enable-ADAccount` — re-enable disabled accounts
- `Set-ADAccountPassword` — reset passwords (with new random password generation)

**Service Management:**
- `Restart-Service` — restart Windows services
- `Stop-Service` — stop Windows services

**Configuration per command:**
- Role capabilities file (`.psrc`) restricting available cmdlets
- Session configuration file (`.pssc`) binding role to virtual account
- Virtual account with minimum required AD/service permissions
- Transcript logging for all sessions

These map directly to your existing `contracts/command-registry/` definitions.

### 6.4 Install MXC Sandbox Tooling (Week 5)

- Deploy sandbox evaluation engine on jump server
- Configure rule sets: "can this command run safely given current system state?"
- Test: submit a command → sandbox evaluates → returns pass/fail verdict
- Integrate with JEA: sandbox must pass before JEA endpoint executes

### 6.5 Build Callback API (Week 5-6)

The jump server needs a lightweight REST API that:
1. Receives execution commands from AWS (via Transit Gateway)
2. Validates mTLS client certificate
3. Evaluates command in MXC sandbox
4. If pass: executes via JEA endpoint
5. Calls back to AWS API Gateway with result (success/failure, exit code, output)

**Stack options:**
- ASP.NET Core minimal API (natural for Windows/PowerShell ecosystem)
- Or a PowerShell-based HTTP listener (simpler but less robust)

### 6.6 Deploy Execution Context (Week 6)

```bash
cd terraform/contexts/execution
terraform init && terraform apply -var-file=../../environments/dev.tfvars
```

Store mTLS certificates:
```bash
aws secretsmanager create-secret \
  --name forgeadmin/execution/mtls-client-cert \
  --secret-string file://client.pem

aws secretsmanager create-secret \
  --name forgeadmin/execution/mtls-client-key \
  --secret-string file://client-key.pem

aws secretsmanager create-secret \
  --name forgeadmin/execution/mtls-ca-cert \
  --secret-string file://ca.pem
```

### 6.7 Integration Test: Full Bridge (Week 7-8)

End-to-end test: AWS Lambda → SQS → Execution Lambda → Transit Gateway → Jump Server → JEA → Callback

Test with a safe, idempotent command:
```powershell
# Test: Get-ADUser (read-only, no side effects)
Get-ADUser -Identity "test.user" -Properties LockedOut, Enabled
```

**Verify:**
- [ ] Lambda successfully sends HTTPS request through Transit Gateway
- [ ] Jump server validates mTLS certificate
- [ ] Sandbox evaluation returns pass verdict for permitted command
- [ ] JEA executes constrained command
- [ ] Callback reaches API Gateway with result
- [ ] Execution Lambda records result in DynamoDB
- [ ] `execution.completed` event published to EventBridge

### 6.8 Phase 3 Exit Criteria

- [ ] Transit Gateway route is active (network team confirmation)
- [ ] Jump server provisioned, hardened, JEA configured
- [ ] MXC sandbox operational (pass/fail verdicts working)
- [ ] mTLS certificates generated and stored in Secrets Manager
- [ ] Callback API running on jump server
- [ ] End-to-end integration test passes (read-only command)
- [ ] Execution context DynamoDB recording step results
- [ ] `execution.completed` events visible in EventBridge

---

## 7. Phase 4 — "Go Live" (Week 6-10)

**Goal:** Promote modules from shadow to supervised execution. Validate POC success criteria. Produce data for production rollout decision.

**Why it's last:** By this point you have weeks of shadow data showing which proposals are correct, real confidence calibration data, and a proven execution bridge. Promoting modules is a low-risk decision backed by evidence.

### 7.1 Promote First Module: AD Account Unlock (Week 6-7)

**Why this one first:**
- Highest volume (most tickets)
- Lowest risk (single-system impact, fully reversible)
- Simplest execution (one cmdlet, clear success/failure)
- Team already knows the correct behavior (easy to validate)

**Promotion steps:**
1. Review shadow data for `Unlock-ADAccount` proposals (accuracy, confidence)
2. Via Dashboard: change module state from "Shadow" to "Enabled"
3. Set confidence threshold conservatively high (e.g., 80)
4. Keep risk classification at current level (all executions require approval initially)
5. Verify first real `plan.proposed` event appears in approval queue

### 7.2 Supervised Execution: Human Approval Required (Week 7-8)

For the first 1-2 weeks of live execution:
- **All** proposed actions go through Approval Gate (regardless of risk level)
- Team members review each proposal on Dashboard
- Approve or reject with rationale
- Monitor execution results and verification outcomes
- Check: does the system do exactly what was proposed?

**What you're validating:**
- Execution bridge works correctly for real commands
- Rollback procedures function as designed
- Confidence scores correlate with actual success rates
- Verification Agent correctly detects success/failure

### 7.3 Add Remaining Ingestion Sources (Week 7-8, parallel)

Once ServiceNow is proven:
- Enable email ingestion (SES receipt rule for `servers@dot.ohio.gov`)
- Enable FortiSIEM webhook (provide webhook URL to FortiSIEM team)
- Verify deduplication works across sources (same incident from multiple channels)

### 7.4 Promote Additional Modules (Week 8-9)

Based on shadow data accuracy, promote in order of increasing risk:

| Priority | Module | Risk | Criteria to Promote |
|----------|--------|------|---------------------|
| 1 | AD Account Unlock | Low | > 90% proposal accuracy in shadow |
| 2 | AD Account Enable | Low | > 90% accuracy, unlock module stable |
| 3 | Service Restart | Medium | > 85% accuracy, clear rollback path |
| 4 | AD Password Reset | Medium | > 85% accuracy, credential handling validated |
| 5 | DNS Record Add | Medium | > 80% accuracy, multi-step verification |

Each promotion follows the same pattern: review shadow data → enable → supervised with approval → observe → adjust threshold.

### 7.5 Evaluate Open Questions (Week 8-9)

With real operational data, evaluate:

| Question | Evaluation Method | Decision Criteria |
|----------|-------------------|-------------------|
| Strands Agents vs Step Functions | Compare agent reasoning quality with and without Strands | Does Strands add measurable value for triage/planning? |
| MXC Sandbox finality | Review sandbox false-positive/false-negative rate | Are sandbox rules too restrictive or too permissive? |
| Confidence calibration | Compare confidence scores to actual outcomes | Do high-confidence proposals actually succeed? |
| KB retrieval quality | Review Research Agent results vs team choices | Does the team use the suggested runbooks? |

Document decisions as new ADRs.

### 7.6 POC Success Validation (Week 9-10)

Run the POC validation suite:

```bash
# Validates all POC success criteria
pnpm tsx scripts/poc-validation.ts
pnpm tsx scripts/validate-runbooks.ts
pnpm tsx scripts/validate-transit-gateway.ts
pnpm tsx scripts/validate-satisfaction.ts
```

**Success criteria (from Requirements):**

| # | Criterion | Target |
|---|-----------|--------|
| 16.1 | 5+ work items per category through full E2E flow | account/service, health, knowledge capture |
| 16.2 | 3+ auto-generated runbooks | Each with title, steps, rollback, verification |
| 16.3 | Satisfaction score ≥ 4/5 from 2+ team members | Accuracy, time savings, usability dimensions |
| 16.4 | Timestamped audit entries at every stage transition | For every processed work item |
| 16.5 | Transit Gateway routing with zero policy violations | Full POC duration |

### 7.7 Collect Satisfaction Survey (Week 9-10)

Direct team members to the Dashboard survey page (`/poc/survey`):
- Accuracy (1-5): "How accurate are ForgeAdmin's proposals?"
- Time savings (1-5): "Does ForgeAdmin reduce your response time?"
- Usability (1-5): "How easy is the Dashboard to use?"
- Free-text: "What would make ForgeAdmin more useful?"

### 7.8 Phase 4 Exit Criteria

- [ ] At least one module promoted from shadow to supervised execution
- [ ] At least 5 work items per category processed through full E2E (ingestion → execution → documentation)
- [ ] At least 3 runbooks auto-generated from resolved incidents
- [ ] Satisfaction survey average ≥ 4.0 from ≥ 2 team members
- [ ] Audit trail complete for all processed work items
- [ ] Transit Gateway zero policy violations
- [ ] Open questions documented as ADRs with decisions
- [ ] Team has enough data to make production rollout recommendation

---

## 8. Risk Register

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Transit Gateway approval delayed > 4 weeks | Phase 3 blocked | Medium | Start request Day 1; escalate at 2-week mark; maintain shadow mode value while waiting |
| Bedrock model access denied/delayed | Phase 2 blocked | Low | Request immediately; have fallback model identified (Claude Instant if Claude 3 unavailable) |
| ServiceNow API access restricted | Phase 2 degraded | Medium | Start with manual incident injection via Dashboard while negotiating API access |
| AI proposals are consistently wrong | POC at risk | Low-Medium | Extensive KB seeding; review and retrain; adjust confidence thresholds; use shadow period to tune before going live |
| Jump server provisioning blocked by ODOT policy | Phase 3 delayed | Low | Identify existing server that could be repurposed; get approval early |
| Team adoption resistance | POC satisfaction fails | Low | Involve team in shadow review early; demonstrate time savings; address feedback quickly |

---

## 9. Parallel Workstreams Visualization

```
Week:  1    2    3    4    5    6    7    8    9    10
       ├────┤
       Phase 1: Lights On
            ├─────────────┤
            Phase 2: Brain Online (shadow mode)
                 ├──────────────────────────────────┤
                 Phase 3: Bridge Building (parallel)
                 │
                 └─> Transit GW request (Day 1!)
                                        ├─────────────────┤
                                        Phase 4: Go Live
```

**Critical path:** Transit Gateway routing approval. Everything else can proceed without it. If the network request takes > 4 weeks, Phase 2 continues delivering value (shadow proposals, KB growth, morning digests) while you wait.

---

## 10. Quick Wins Summary (Ordered by Speed-to-Value)

| # | Win | Timeline | Value |
|---|-----|----------|-------|
| 1 | Dashboard live, team can log in | Day 3 | Tangible proof of progress; unblocks everything |
| 2 | CloudWatch dashboards visible | Day 4 | Operational visibility from day one |
| 3 | CI/CD pipeline proven | Day 4 | Confidence in deployment automation |
| 4 | First real incident ingested | Week 2 | System is consuming real work |
| 5 | First AI triage proposal visible | Week 2-3 | Core value proposition demonstrated |
| 6 | Morning digest in Teams/Slack | Week 3 | Daily team awareness without Dashboard login |
| 7 | Knowledge gaps identified automatically | Week 3-4 | Shows where documentation is missing |
| 8 | First auto-generated runbook | Week 7-8 | KB grows from real resolutions |
| 9 | First autonomous execution (with approval) | Week 7 | Full loop closed |
| 10 | Second module promoted | Week 8-9 | Pattern proven, not just one-off |

---

## 11. Post-POC: Production Graduation Checklist

After POC success validation, before declaring "production ready":

- [ ] Remove `force_destroy = true` from all Terraform resources
- [ ] Create `staging.tfvars` and `prod.tfvars` environment configurations
- [ ] Implement multi-environment pipeline (dev → staging → prod promotion)
- [ ] Configure DynamoDB point-in-time recovery (already in Terraform, verify enabled)
- [ ] Enable S3 Object Lock for audit archival (tamper-evidence for compliance)
- [ ] Rotate mTLS certificates (verify auto-rotation via Secrets Manager)
- [ ] Configure CloudFront WAF rules for Dashboard
- [ ] Review and tighten IAM policies (remove any overly-broad dev permissions)
- [ ] Enable AWS Config rules for drift detection
- [ ] Set up cost alerts (Budget alarms for unexpected spend)
- [ ] Document runbook for ForgeAdmin itself (how to troubleshoot the platform)
- [ ] Create on-call rotation for ForgeAdmin operations
- [ ] Establish change management process (who can promote modules, approval chain)

---

## 12. Dependencies and Blockers

| Dependency | Needed By | Owner | Status |
|------------|-----------|-------|--------|
| AWS account with required permissions | Phase 1, Day 1 | You | Not started |
| GitHub repository secrets (deploy role ARN, state bucket) | Phase 1, Day 1 | You | Not started |
| Bedrock model access (Claude + Titan) | Phase 2 | You (AWS Console) | Not started |
| ServiceNow API credentials (read-only) | Phase 2 | You + ServiceNow admin | Not started |
| Teams/Slack incoming webhook | Phase 2 | You | Not started |
| Transit Gateway routing approval | Phase 3 | Network team | Not started |
| Windows Server provisioning approval | Phase 3 | You + server team | Not started |
| Domain-joined service account for JEA | Phase 3 | You + AD admin | Not started |
| FortiSIEM webhook configuration | Phase 4 | You + security team | Not started |
| SES verified sending identity | Phase 2 (escalation) | You | Not started |

---

## 13. Decision Log

| Decision | Rationale |
|----------|-----------|
| Deploy Dashboard first (before brain) | Team sees immediate progress; provides UI for all subsequent monitoring |
| ServiceNow before email/FortiSIEM | Highest volume source; proves ingestion pattern; other sources add incrementally |
| Shadow mode before any execution | Weeks of accuracy data before risking production changes |
| AD Account Unlock as first live module | Lowest risk, highest volume, simplest verification, most reversible |
| Transit Gateway request on Day 1 of Phase 3 | Longest lead time item; must start early even before server is ready |
| Conservative confidence thresholds initially | Start high (80+), lower based on observed accuracy; safer than too permissive |
| Supervised (all-approval) before auto-execute | Build trust incrementally; team controls pace of autonomy expansion |
