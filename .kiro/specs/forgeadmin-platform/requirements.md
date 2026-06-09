# Requirements Document

## Introduction

ForgeAdmin is an agentic multi-agent Windows SysAdmin platform for the ODOT Windows Server team. The platform ingests incidents from ServiceNow, email, and FortiSIEM alerts, then orchestrates specialized agents to research, plan, execute, and document resolutions. ForgeAdmin operates on a progressive autonomy model — starting as a "Junior SysAdmin" in shadow mode and advancing to autonomous execution as confidence grows. The platform runs serverless on AWS (Bedrock AgentCore Runtime, Strands Agents) with sandboxed execution on a hardened on-prem Windows jump server, connected via Transit Gateway. A management dashboard gives the server team full control over module lifecycle, promotion strategies, and confidence thresholds.

## Glossary

- **ForgeAdmin**: The overall multi-agent platform acting as an agentic Junior System Administrator
- **Supervisor_Agent**: The top-level orchestrator that triages incoming work and delegates to specialized agents
- **Triage_Agent**: The agent responsible for classifying incoming incidents by category, risk level, and urgency
- **Research_Agent**: The agent that queries the Bedrock Knowledge Base for relevant runbooks, documentation, and historical resolutions
- **Planning_Agent**: The agent that generates an explainable execution plan with confidence scoring
- **Execution_Agent**: The agent that carries out approved actions in the sandboxed on-prem environment
- **Verification_Agent**: The agent that validates execution results against expected outcomes
- **Documentation_Agent**: The agent that auto-generates work notes, runbooks, and KB updates from completed work
- **Knowledge_Base**: The Bedrock-hosted living repository of how-to docs, auto-generated runbooks, and historical resolutions
- **Module**: A discrete, toggleable capability unit (e.g., AD account management, service restarts, health checks)
- **Shadow_Mode**: An observe-only operational state where a module processes tickets and proposes actions but never executes
- **Confidence_Score**: A numeric metric (0-100) representing the platform's certainty in a proposed action
- **Promotion_Strategy**: The configured method for advancing a module's autonomy level (manual or auto-suggest)
- **Approval_Gate**: A human decision point required before execution of medium or high-risk actions
- **Jump_Server**: The hardened on-prem Windows server where all execution actions are sandboxed via JEA and MXC
- **JEA**: Just Enough Administration — PowerShell constrained endpoints limiting available commands
- **MXC_Sandbox**: The sandboxed execution environment on the jump server for safe command evaluation
- **Transit_Gateway**: The existing AWS-to-ODOT network path used for all cloud-to-on-prem communication
- **Circuit_Breaker**: A reliability pattern that stops cascading failures by halting requests when error thresholds are exceeded
- **Morning_Digest**: The daily 7am summary of overnight activity and pending items delivered to the Teams/Slack channel
- **Dashboard**: The web-based management interface for the server team to control modules, view metrics, and manage approvals
- **Runbook**: A structured document capturing step-by-step resolution procedures for specific incident types

## Requirements

### Requirement 1: Incident Ingestion

**User Story:** As a Windows Server team member, I want ForgeAdmin to automatically ingest incidents from all supported sources, so that no actionable ticket is missed and response times are reduced.

#### Acceptance Criteria

1. WHEN a new incident is created in ServiceNow, THE Supervisor_Agent SHALL ingest the incident and create an internal work item within 60 seconds of creation
2. WHEN an email is received at servers@dot.ohio.gov, THE Supervisor_Agent SHALL parse the email and create an internal work item within 60 seconds of receipt, extracting at minimum: sender address, subject line, received timestamp, and body content
3. WHEN a FortiSIEM alert is fired, THE Supervisor_Agent SHALL ingest the alert and create an internal work item within 60 seconds of alert generation
4. THE Supervisor_Agent SHALL normalize all ingested items into a common internal work item format that includes at minimum: source system identifier, original ticket or alert ID, timestamp of creation, severity or priority level, short description, and full description or body
5. IF an ingestion source becomes unavailable (connection timeout exceeding 30 seconds, authentication failure, or HTTP error response), THEN THE Supervisor_Agent SHALL log the failure, retry with exponential backoff capped at a maximum interval of 5 minutes, and notify the Teams/Slack channel after 3 consecutive failures
6. IF an email received at servers@dot.ohio.gov cannot be parsed due to missing subject line or empty body, THEN THE Supervisor_Agent SHALL create the internal work item with available fields populated, flag it as requiring manual review, and notify the Teams/Slack channel
7. IF an incident or alert has already been ingested (matched by source system and original ticket or alert ID), THEN THE Supervisor_Agent SHALL skip duplicate creation and log the duplicate detection

### Requirement 2: Incident Triage and Classification

**User Story:** As a Windows Server team member, I want incoming incidents automatically classified by category, risk level, and urgency, so that work is prioritized and routed to the correct module.

#### Acceptance Criteria

1. WHEN a work item is ingested, THE Triage_Agent SHALL classify the item into exactly one category from the following: account/service request, health remediation, security alert, knowledge capture
2. WHEN a work item is ingested, THE Triage_Agent SHALL assign a risk level of low (single-system impact, fully reversible), medium (multi-system impact or partially reversible), or high (environment-wide impact or irreversible)
3. WHEN a work item is ingested, THE Triage_Agent SHALL assign an urgency level of critical (SLA breach within 1 hour), high (SLA breach within 4 hours), normal (SLA breach within 24 hours), or low (no imminent SLA pressure)
4. THE Triage_Agent SHALL complete classification within 30 seconds of receiving a work item; classification completing at exactly 30 seconds SHALL be treated as successful
5. THE Triage_Agent SHALL include a justification string that references at least the category, risk level, and urgency level assigned, stating the input attributes that informed each decision
6. IF a work item lacks sufficient attributes to determine category, risk, or urgency, THEN THE Triage_Agent SHALL assign a default risk level of high, a default urgency level of high, and include a justification string indicating which attributes were missing
7. IF classification is not completed within 30 seconds, THEN THE Triage_Agent SHALL abandon the classification attempt, preserve any valid risk/urgency assignments already made before timeout, default only the unassigned fields to high risk and critical urgency, and flag the work item for manual review

### Requirement 3: Research and Knowledge Base Retrieval

**User Story:** As a Windows Server team member, I want the platform to automatically research relevant documentation and historical resolutions, so that proposed actions are informed by institutional knowledge.

#### Acceptance Criteria

1. WHEN a work item is classified, THE Research_Agent SHALL query the Knowledge_Base for runbooks and historical resolutions matching the work item's classification category and extracted keywords
2. WHEN the Knowledge_Base query completes, THE Research_Agent SHALL return a ranked list of up to 10 knowledge items, each with a relevance score between 0.0 and 1.0, including only items scoring at or above 0.3
3. IF no knowledge items meet the minimum relevance score of 0.3, THEN THE Research_Agent SHALL indicate a knowledge gap and flag the item for potential runbook creation after resolution
4. THE Research_Agent SHALL complete research within 15 seconds of receiving a classified work item
5. WHEN a resolution is completed, THE Documentation_Agent SHALL update the Knowledge_Base with the resolution steps, root cause, and affected systems within 5 minutes; IF the Knowledge_Base is unavailable during this window, THE Documentation_Agent SHALL fail the update requirement and log the unavailability
6. IF the Knowledge_Base is unavailable during a research query, THEN THE Research_Agent SHALL notify the requesting agent of the retrieval failure and proceed with the work item flagged as lacking knowledge context

### Requirement 4: Explainable Planning with Confidence Scoring

**User Story:** As a Windows Server team member, I want every proposed action to include clear justification, confidence score, and execution plan, so that I can make informed approval decisions.

#### Acceptance Criteria

1. WHEN research results are available, THE Planning_Agent SHALL generate an execution plan containing ordered steps (each with a description, expected outcome, and rollback procedure that specifies the target restoration state), limited to a maximum of 20 steps per plan
2. THE Planning_Agent SHALL assign a Confidence_Score (0-100) to each proposed execution plan and include a breakdown of the factors that contributed to the score
3. THE Planning_Agent SHALL include a justification composed of structured text that references at least one knowledge item by identifier and explains the reasoning chain from evidence to proposed action
4. THE Planning_Agent SHALL link every proposal to its originating ServiceNow ticket for traceability
5. IF the Planning_Agent cannot generate a plan with a Confidence_Score above 30, THEN THE Planning_Agent SHALL escalate the work item to a human operator within 5 minutes, including a summary of findings that lists the research attempted, the gaps identified, and the reason the confidence threshold was not met
6. IF the Planning_Agent fails to retrieve research results within 10 minutes of a request, or detects other research problems (corrupted data, incomplete results, conflicting knowledge items), THEN THE Planning_Agent SHALL notify the human operator with the originating ticket reference and the nature of the issue

### Requirement 5: Human Approval Gates

**User Story:** As a Windows Server team lead, I want medium and high-risk actions to require explicit human approval before execution, so that automated actions remain safe and controlled.

#### Acceptance Criteria

1. WHEN a proposed action has a risk level of medium or high, THE Supervisor_Agent SHALL route the proposal to an Approval_Gate before execution
2. WHEN a proposed action has a risk level of low AND the module Confidence_Score exceeds the configured threshold (a decimal value between 0.0 and 1.0), THE Supervisor_Agent SHALL auto-execute the action and send a notification to the Teams/Slack channel including the action name, risk level, confidence score, and execution result; IF any concurrent approval workflow rejects the same action, THE Supervisor_Agent SHALL cancel auto-execution immediately
3. THE Dashboard SHALL present pending approvals with full context: confidence score, justification, execution plan, risk level, and linked ServiceNow ticket
4. IF an approval request receives no response within the configured SLA (default: 30 minutes, configurable between 5 minutes and 24 hours), THEN THE Supervisor_Agent SHALL send a reminder notification to the assigned approver and escalate to the next-level approver in the escalation chain after a second SLA period has elapsed
5. WHEN an operator approves or rejects a proposal, THE Supervisor_Agent SHALL log the decision with operator identity, timestamp, and decision rationale in the immutable audit trail
6. IF an approval request is rejected by the operator, THEN THE Supervisor_Agent SHALL cancel the proposed action, notify the requesting module of the rejection, and retain the proposal in the audit trail with a rejected status
7. IF an escalated approval request receives no response from the next-level approver within a third SLA period, THEN THE Supervisor_Agent SHALL automatically reject the proposal, log the timeout as the rejection reason, and notify the original requestor and all approvers in the escalation chain

### Requirement 6: Sandboxed Execution on On-Prem Jump Server

**User Story:** As a Windows Server team member, I want all execution actions to run in a sandboxed environment on the on-prem jump server, so that the blast radius of any action is contained and least-privilege is enforced.

#### Acceptance Criteria

1. THE Execution_Agent SHALL execute all approved actions exclusively on the designated Jump_Server via JEA constrained endpoints
2. THE Execution_Agent SHALL evaluate all commands within the MXC_Sandbox within 30 seconds and produce a pass or fail verdict before permitting execution against the target system
3. WHILE executing an action, THE Execution_Agent SHALL enforce least-privilege by using only the JEA-permitted command set for the specific module
4. IF an execution step fails, THEN THE Execution_Agent SHALL halt the plan immediately regardless of rollback success, execute the defined rollback procedure within 120 seconds, and notify the Supervisor_Agent within 5 seconds of halting
5. THE Execution_Agent SHALL transmit all execution commands and results through the Transit_Gateway connection
6. IF the MXC_Sandbox evaluation returns a fail verdict for a command, THEN THE Execution_Agent SHALL block execution of that command, halt the plan, and notify the Supervisor_Agent with the identity of the rejected command and the sandbox rule that triggered rejection
7. IF an execution step fails and no rollback procedure is defined for that step, THEN THE Execution_Agent SHALL halt the plan, preserve the current system state without modification, and escalate to the Supervisor_Agent indicating that manual intervention is required
8. IF the MXC_Sandbox passes but execution is not permitted for other reasons (approval revoked, module disabled, circuit breaker tripped), THEN THE Execution_Agent SHALL halt the plan and notify the Supervisor_Agent with the reason execution was blocked

### Requirement 7: Execution Verification

**User Story:** As a Windows Server team member, I want executed actions to be automatically verified against expected outcomes, so that failures are caught immediately and remediated.

#### Acceptance Criteria

1. WHEN an execution plan completes, THE Verification_Agent SHALL compare each step's actual outcome (exit code, system state change, or command output) against the expected outcome defined in the plan and record a pass/fail result per step
2. IF verification detects that any step's actual outcome does not match the expected outcome defined in the plan, or detects an overall verification mismatch regardless of individual step results, THEN THE Verification_Agent SHALL flag the work item as requiring human review and notify the Teams/Slack channel with the work item identifier, the failed step, and the observed versus expected outcome
3. IF the verification process itself fails or does not complete within 60 seconds of execution completion, THEN THE Verification_Agent SHALL flag the work item as requiring human review and notify the Teams/Slack channel indicating a verification failure
4. WHEN all steps pass verification, THE Verification_Agent SHALL update the ServiceNow incident with resolution details including the actions performed, the verification results per step, and the timestamp of completion as work notes
5. THE Verification_Agent SHALL complete verification within 60 seconds of execution completion; verification completing at exactly 60 seconds SHALL be treated as successful completion

### Requirement 8: Auto-Documentation and Knowledge Base Updates

**User Story:** As a Windows Server team member, I want the platform to automatically generate high-quality documentation and update the Knowledge Base from completed work, so that institutional knowledge grows continuously.

#### Acceptance Criteria

1. WHEN a work item is successfully resolved, THE Documentation_Agent SHALL, within 5 minutes, generate a work note containing resolution summary, root cause, steps taken, and affected systems, and attach it to the corresponding ServiceNow incident
2. WHEN a resolution addresses a knowledge gap that was previously identified by the Triage_Agent or Documentation_Agent as having no matching runbook, THE Documentation_Agent SHALL auto-generate a runbook from the resolution steps within 10 minutes of resolution; IF active processing requires additional time, THE Documentation_Agent SHALL continue generation beyond 10 minutes rather than failing
3. THE Documentation_Agent SHALL produce runbooks containing: title, applicable incident types, prerequisites, step-by-step procedure, expected outcomes, and rollback steps
4. (See Requirement 16.2 — POC success criterion for minimum 3 auto-generated runbooks)
5. WHEN a new runbook is generated, THE Documentation_Agent SHALL notify the Teams/Slack channel with a summary of no more than 200 characters and a link to the full runbook for team review
6. IF the Documentation_Agent fails to attach a work note or generate a runbook due to a ServiceNow API error or timeout, THEN THE Documentation_Agent SHALL retry the operation up to 3 times at 30-second intervals and, if still unsuccessful, notify the Teams/Slack channel with an error indication regardless of whether the logging itself succeeds, and log the failure when the audit system is available

### Requirement 9: Modular Architecture with Shadow Mode

**User Story:** As a Windows Server team lead, I want each capability to be a discrete module that can be independently enabled, disabled, or placed in shadow mode, so that new capabilities can be proven safe before going live.

#### Acceptance Criteria

1. THE ForgeAdmin SHALL organize all capabilities as discrete modules that can be independently enabled or disabled without altering the operational state or interrupting in-progress work items of other modules
2. WHEN a module is placed in Shadow_Mode, THE module SHALL process incoming work items, generate proposals, and log proposed actions without executing any changes
3. WHILE a module is in Shadow_Mode, THE module SHALL record what actions it would have taken, including confidence scores and execution plans, and retain those records for a minimum of 30 days for later review
4. WHEN a module is toggled from enabled to disabled, THE ForgeAdmin SHALL complete any in-progress work items for that module within 300 seconds before fully disabling execution
5. THE Dashboard SHALL display the current operational state (enabled, disabled, shadow) of each module within 5 seconds of a state change
6. IF a module's in-progress work items do not complete within the 300-second grace period during a disable transition, THEN THE ForgeAdmin SHALL force-stop the remaining work items only after the full 300-second period has elapsed, log each force-stopped item with its last known state, and transition the module to disabled

### Requirement 10: Module Promotion Strategy

**User Story:** As a Windows Server team lead, I want to configure how each module advances in autonomy level, so that I maintain control over the pace of automation expansion.

#### Acceptance Criteria

1. THE Dashboard SHALL allow configuration of each module's Promotion_Strategy as either manual promotion or auto-suggest promotion; the two strategies SHALL be mutually exclusive per module
2. WHERE auto-suggest promotion is configured, THE ForgeAdmin SHALL recommend promotion when a module's accuracy metrics (ratio of correct proposals to total proposals, measured as a percentage 0-100) exceed the configured threshold (0-100) over a configurable evaluation window (7-90 days); manual promotion triggers SHALL be disabled for that module
3. WHERE auto-suggest promotion is configured, THE ForgeAdmin SHALL require explicit human approval before applying any promotion
4. WHERE manual promotion is configured, THE ForgeAdmin SHALL advance a module's autonomy level only when a team lead explicitly triggers promotion via the Dashboard; auto-suggest recommendations SHALL be disabled for that module
5. THE Dashboard SHALL display per-module accuracy metrics, confidence trends over the configured evaluation window, and promotion history retained for a minimum of 365 days
6. IF a promotion recommendation is rejected by the approver, THEN THE ForgeAdmin SHALL log the rejection with rationale, retain the module at its current autonomy level, and not re-recommend promotion until the next evaluation window completes

### Requirement 11: Management Dashboard

**User Story:** As a Windows Server team member, I want a centralized dashboard showing real-time platform status, module health, execution history, and pending approvals, so that I have full visibility into ForgeAdmin operations.

#### Acceptance Criteria

1. THE Dashboard SHALL display a view of all modules with their current state (enabled, disabled, shadow), Confidence_Score (0-100), and last execution timestamp, refreshed within 5 seconds of any state change
2. THE Dashboard SHALL provide execution history with filtering by module, date range, risk level, and outcome (success, failure, pending), retaining a minimum of 90 days of history
3. WHEN an operator initiates a module state change (enable, disable, or shadow mode) via the Dashboard and provides explicit confirmation, THE Dashboard SHALL immediately apply the transition
4. THE Dashboard SHALL display confidence threshold configuration controls per module accepting integer values between 0 and 100 inclusive
5. THE Dashboard SHALL enforce Role-Based Access Control: server team members receive full access (toggle modules, configure thresholds, approve actions); other roles receive read-only access limited to viewing status, history, and metrics without modification capability
6. IF a module state change initiated via the Dashboard fails, THEN THE Dashboard SHALL display an error indication describing the failure reason and preserve the module's previous state

### Requirement 12: Communication and Notifications

**User Story:** As a Windows Server team member, I want ForgeAdmin to communicate via Teams/Slack and deliver a daily morning digest, so that I stay informed without needing to check the dashboard constantly.

#### Acceptance Criteria

1. THE ForgeAdmin SHALL post notifications to the configured Teams/Slack channel within 30 seconds of event occurrence for: auto-executed actions, approval requests, execution failures, and system alerts (circuit breaker trips, degradation events, ingestion source failures); IF the 30-second timing requirement is violated, THE ForgeAdmin SHALL escalate via an alternative notification method (email or Dashboard alert)
2. WHEN the local time reaches 7:00 AM Eastern, THE ForgeAdmin SHALL deliver a Morning_Digest to the configured Teams/Slack channel containing: a summary of activity from 7:00 PM to 7:00 AM, pending approval items with age, module health status for all enabled modules, and any anomalies detected (circuit breaker trips, error rate threshold breaches, agent failures, or ingestion outages)
3. WHEN a critical event occurs (execution failure, circuit breaker trip, ingestion source outage), THE ForgeAdmin SHALL send a notification to the Teams/Slack channel within 60 seconds of event detection; IF the 60-second timing requirement is violated, THE ForgeAdmin SHALL escalate via an alternative notification method
4. THE ForgeAdmin SHALL support natural language interaction in the Teams/Slack channel for status queries (module state, pending approvals, recent execution outcomes) and commands (approve or reject pending proposals, toggle module state) and SHALL respond within 30 seconds of receiving a message
5. IF a notification delivery to the Teams/Slack channel fails, THEN THE ForgeAdmin SHALL retry delivery up to 3 times with exponential backoff, log the failure in the audit trail, and display the undelivered notification on the Dashboard

### Requirement 13: Security, Audit, and Compliance

**User Story:** As a security-conscious team lead, I want a full immutable audit trail, sensitive data protection, and role-based access controls, so that the platform meets ODOT security and compliance requirements.

#### Acceptance Criteria

1. THE ForgeAdmin SHALL maintain an append-only, tamper-evident audit trail of all actions including: agent decisions, human approvals, execution commands, results, and timestamps linked to ServiceNow tickets, with each audit entry written within 5 seconds of the action occurring and retained for a minimum of 365 days
2. WHEN input data contains sensitive information (credentials, API keys, tokens, PII including names, SSNs, email addresses, and phone numbers, or secrets such as passwords and certificates), THE ForgeAdmin SHALL detect and redact sensitive data by replacing it with a redaction placeholder before sending content to the LLM; IF redaction would render the data unusable for resolution, THEN THE ForgeAdmin SHALL escalate the work item to a human operator with full context preserved on-prem (no LLM processing), log the escalation reason in the audit trail, and notify the Teams/Slack channel
3. THE ForgeAdmin SHALL enforce Role-Based Access Control with at minimum two roles: team lead (full access to approvals, audit trail viewing, module configuration, and skill addition) and team member (access to approvals and audit trail viewing, but read-only access to module configuration and no access to skill addition)
4. IF the error rate for a module's automated executions exceeds the configured threshold (default: 3 failures within a rolling 15-minute window), THEN THE ForgeAdmin SHALL trip the circuit breaker and halt all automated execution for that module; circuit breaker responses SHALL only be triggered by an actual trip event
5. IF a circuit breaker trips, THEN THE ForgeAdmin SHALL route all affected work items to human operators and notify the Teams/Slack channel within 60 seconds of the trip event

### Requirement 14: Reliability and Graceful Degradation

**User Story:** As a Windows Server team member, I want the platform to degrade gracefully under failure conditions, so that partial outages do not cause total loss of functionality.

#### Acceptance Criteria

1. IF the Knowledge_Base becomes unavailable, THEN THE Research_Agent SHALL append a "KB unavailable" flag to the research results and proceed with available context only; THE Planning_Agent SHALL cap the Confidence_Score of any generated plan at 50 when this flag is present
2. IF the Transit_Gateway connection is lost, THEN THE Execution_Agent SHALL queue approved actions for a maximum of 60 minutes, retry connectivity at 30-second intervals, and notify operators of the delay within 60 seconds of connection loss; IF the queue exceeds 60 minutes without restored connectivity, THEN THE Execution_Agent SHALL escalate all queued items to human operators
3. IF an individual agent fails, THEN THE Supervisor_Agent SHALL remove the failed agent from the processing pipeline only after a definitive failure has occurred (not preemptively based on health checks), reroute affected work items to human operators, continue processing with remaining agents, and log a degradation event including the failed agent identity and timestamp
4. THE ForgeAdmin SHALL implement bulkhead isolation between modules so that one module's failure does not cascade to other modules
5. WHEN operating in degraded mode, THE ForgeAdmin SHALL within 30 seconds display on the Dashboard and post to the Teams/Slack channel a degradation notification identifying: which component is degraded, the time degradation began, and which capabilities are affected; both notification channels are required and IF either channel fails, THE ForgeAdmin SHALL escalate the notification failure as a separate issue
6. WHEN a previously failed component recovers, THE ForgeAdmin SHALL restore normal processing within 60 seconds, clear the degradation indicators on the Dashboard and Teams/Slack channel, and log a recovery event with the total degradation duration

### Requirement 15: Infrastructure as Code and Deployment

**User Story:** As a DevOps team member, I want all infrastructure defined as Terraform IaC with CI/CD via GitHub Actions, so that deployments are repeatable, auditable, and version-controlled.

#### Acceptance Criteria

1. THE ForgeAdmin SHALL define all AWS infrastructure as Terraform modules stored in the GitHub repository
2. THE ForgeAdmin SHALL use zero EC2 instances on the AWS side, relying entirely on serverless services (Lambda, Step Functions, Bedrock, EventBridge)
3. WHEN code is merged to the main branch, THE GitHub_Actions pipeline SHALL execute plan, validate, and apply stages for infrastructure changes, completing all stages within 15 minutes of merge
4. THE ForgeAdmin SHALL version all agent prompts, tool definitions, and module configurations in the GitHub repository, where rollback is performed by reverting to a prior tagged commit and re-running the pipeline
5. IF a deployment fails (defined as a non-zero exit code from any Terraform apply or validation stage), THEN THE GitHub_Actions pipeline SHALL automatically roll back to the last successfully deployed commit (identified by the most recent pipeline run that completed all stages without error), complete rollback within 10 minutes of the failure event, and notify the Teams/Slack channel with the failure reason and rollback target
6. WHEN a Terraform plan includes resource destruction or replacement, THE GitHub_Actions pipeline SHALL require manual approval from a team member before executing the apply stage; IF no approval is received within 24 hours, THE pipeline SHALL automatically cancel the deployment and require the change to be re-triggered

### Requirement 16: POC Scope and Success Validation

**User Story:** As a project stakeholder, I want a focused 6-10 week POC demonstrating end-to-end closed-loop workflow for low-to-medium risk tickets, so that we can validate the platform's value before full rollout.

#### Acceptance Criteria

1. THE ForgeAdmin POC SHALL successfully process a minimum of 5 work items per ticket category (account/service requests, routine health remediations, and knowledge capture) through the complete end-to-end flow (ingestion → research → proposal → approval → execution → documentation) within the POC period
2. THE ForgeAdmin POC SHALL produce a minimum of 3 auto-generated runbooks during the POC period, where each runbook contains a title, triggering condition, step-by-step procedure, rollback steps, and verification criteria
3. THE ForgeAdmin POC SHALL achieve an average satisfaction score of 4 or higher on a 1-to-5 scale from a minimum of 2 server team members as measured by a structured survey covering accuracy, time savings, and usability dimensions
4. THE ForgeAdmin POC SHALL record a timestamped entry with actor identification and stage outcome at each workflow stage transition (ingestion, research, proposal, approval, execution, documentation) for every processed work item
5. THE ForgeAdmin POC SHALL confirm Transit_Gateway routing with zero policy violations throughout the 6-to-10-week POC duration

### Requirement 17: Agent Skills and Steering Documents

**User Story:** As a Windows Server team lead, I want to add Skills and Steering documents to expand and fine-tune each agent's capabilities and behavior over time, so that the platform grows in competence just like a Junior SysAdmin gaining experience under mentorship.

#### Acceptance Criteria

1. THE Dashboard SHALL allow a team_lead to create, update, delete, enable, and disable Skill documents that expand an agent's capabilities through prompt instructions
2. THE Dashboard SHALL allow a team_lead to create, update, delete, enable, and disable Steering documents that modify an agent's behavioral guidelines and decision-making rules
3. WHEN a Skill or Steering document is created or updated, THE ForgeAdmin SHALL store the document with full version history and allow rollback to any prior version
4. THE ForgeAdmin SHALL support two scoping levels for Skills and Steering documents: global (applying to all agents) and agent-specific (applying to a single named agent)
5. WHEN an agent is invoked, THE ForgeAdmin SHALL compose the agent's prompt by injecting all enabled Skills and Steering documents applicable to that agent in priority order: base prompt → global steering → agent-specific steering → global skills → agent-specific skills
6. WHEN a Skill or Steering document is created, updated, or rolled back, THE change SHALL take effect immediately on the agent's next invocation without requiring redeployment or restart
7. IF the total composed prompt (base + steering + skills + runtime context) exceeds the model's context window, THEN THE ForgeAdmin SHALL drop lowest-priority documents first (global skills, then global steering) while preserving agent-specific documents, and log which documents were dropped
8. IF the Skills/Steering storage becomes unavailable during agent invocation, THEN THE agent SHALL proceed with its base prompt only, log a warning, and flag the work item as "operating without full skill context"
9. THE Dashboard SHALL display a token budget indicator showing how much of each agent's context window is consumed by active Skills and Steering documents
10. WHEN a Skill or Steering document is created, updated, deleted, or rolled back, THE ForgeAdmin SHALL log the operation in the audit trail with team_lead identity, timestamp, document version, and action performed
11. THE Dashboard SHALL restrict Skill and Steering document management (create, update, delete, rollback) to the team_lead role; team_member role SHALL have read-only access to view active documents
12. WHEN a Skill or Steering document change occurs, THE ForgeAdmin SHALL notify the Teams/Slack channel within 30 seconds with the document title, target agent or scope, action performed, and acting team lead identity
