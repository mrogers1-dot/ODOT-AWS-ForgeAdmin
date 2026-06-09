# ADR-0008: JSON Schema + OpenAPI Contracts

## Status

Accepted

## Context

With 8 bounded contexts communicating via events and a dashboard API, we need:

- A single source of truth for event structures
- Compile-time and runtime validation of events
- API documentation that stays in sync with implementation
- Contract testing to catch breaking changes before deployment

Options considered:

1. **Protocol Buffers** — strong typing, efficient serialization, but overkill for JSON/EventBridge
2. **JSON Schema** — native to EventBridge Schema Registry, widely supported
3. **TypeScript types only** — no runtime validation, no cross-language support

## Decision

We use JSON Schema for event contracts and OpenAPI 3.1 for the REST/WebSocket API:

1. **Event contracts** — JSON Schema files in `contracts/events/{context}/` validated at publish time
2. **API contracts** — OpenAPI 3.1 specification in `contracts/api/openapi.yaml`
3. **Validation utility** — `src/shared/contract-validator.ts` validates events against schema before EventBridge publish
4. **CI validation** — PR pipeline validates all schemas are valid and API spec passes linting
5. **EventBridge Schema Registry** — Schemas registered for discoverability

## Consequences

### Positive

- EventBridge Schema Registry natively supports JSON Schema — seamless integration
- OpenAPI generates client SDKs, mock servers, and documentation automatically
- Runtime validation catches contract violations before they propagate
- CI validation prevents breaking changes from reaching deployment

### Negative

- JSON Schema can be verbose for complex nested structures
- Keeping schemas, TypeScript types, and implementations in sync requires discipline
- OpenAPI 3.1 tooling is less mature than 3.0 in some ecosystems

### Neutral

- Schemas serve as documentation — readable without code context
- Version field in EventEnvelope enables schema evolution without breaking consumers
