# ADR-0003: Hexagonal Architecture for Complex Contexts

## Status

Accepted

## Context

ForgeAdmin has contexts with varying levels of domain complexity:

- **High complexity:** Orchestration (multi-agent coordination, state machines, approval gates), Execution (on-prem bridge, multiple adapters, rollback logic), and Correlation (rule engine, session management, pattern detection)
- **Low complexity:** Ingestion (straightforward ETL), Knowledge Base (thin handlers around Bedrock), Communication (notification routing)

Complex contexts have many external dependencies (Bedrock, DynamoDB, EventBridge, Step Functions) that need to be testable in isolation. Simple Lambda handlers with inline AWS SDK calls become untestable spaghetti at this complexity level.

## Decision

We apply hexagonal architecture (ports and adapters) to the Orchestration, Execution, and Correlation contexts:

1. **Domain layer** — Pure business logic with no infrastructure imports. Defines port interfaces.
2. **Ports** — Interfaces declaring what the domain needs (IKnowledgeBase, IModelInvoker, IEventPublisher, IStateStore)
3. **Adapters** — Concrete implementations of ports (BedrockModel, DynamoDBState, EventBridgePublisher)
4. **Handlers** — Thin wiring layer connecting Lambda events to domain logic via adapters

Simple contexts (Ingestion, Knowledge Base, Communication) use straightforward Lambda handlers without this overhead.

## Consequences

### Positive

- Domain logic is 100% unit-testable with mock adapters
- External dependencies can be swapped without touching business logic
- Clear separation makes code navigation intuitive
- Property-based tests can target pure domain functions directly

### Negative

- More files and interfaces for complex contexts (~4x vs simple Lambda)
- Slight onboarding cost for developers unfamiliar with the pattern
- Risk of over-engineering if applied to simple contexts

### Neutral

- Pattern choice is per-context, not global — right tool for the job
- Port interfaces serve as documentation of external dependencies
