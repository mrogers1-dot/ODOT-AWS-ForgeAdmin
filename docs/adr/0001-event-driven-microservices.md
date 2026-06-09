# ADR-0001: Event-Driven Microservices Architecture

## Status

Accepted

## Context

ForgeAdmin is an AI-powered IT operations platform for Ohio DOT that must coordinate multiple autonomous agents (triage, research, planning, execution, verification) across different bounded contexts. The system needs:

- Loose coupling between contexts to allow independent development and deployment
- Asynchronous processing for long-running AI agent workflows
- Auditability of all decisions and actions
- Resilience — failure in one context must not cascade

Direct service-to-service communication (REST/gRPC) would create tight coupling, make the system fragile to partial failures, and complicate audit trail construction.

## Decision

We adopt an event-driven microservices architecture where:

1. Each bounded context communicates exclusively via domain events published to a shared event bus
2. No direct Lambda-to-Lambda or service-to-service calls between contexts
3. Each context owns its data store and exposes state only through events
4. Events are immutable facts — once published, they represent something that happened

## Consequences

### Positive

- Contexts are independently deployable and destroyable
- Natural audit trail — every state change is an event
- Temporal decoupling — producers and consumers don't need to be available simultaneously
- Easy to add new consumers without modifying producers

### Negative

- Eventual consistency — no synchronous request/response across contexts
- Debugging requires distributed tracing (correlationId propagation)
- Event schema evolution requires careful versioning

### Neutral

- Requires an event schema contract system to maintain compatibility
- Team must adopt event-first thinking for all cross-context communication
