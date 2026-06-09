# ADR-0006: React SPA + Serverless Dashboard

## Status

Accepted

## Context

ForgeAdmin needs a human-in-the-loop dashboard for:

- Real-time visibility into agent pipeline status
- Approval gates for medium/high risk execution plans
- Module state management and configuration
- Audit trail browsing

Options considered:

1. Server-rendered (Next.js/Remix) — adds server infrastructure
2. React SPA + API Gateway/Lambda — fully serverless, no servers to manage
3. Low-code tool (Retool/Appsmith) — limited customization, vendor lock-in

## Decision

We build a React SPA with a serverless backend:

1. **Frontend** — React 19 SPA with Zustand for state management, hosted on CloudFront + S3
2. **API** — API Gateway (HTTP API) backed by Lambda functions
3. **Real-time** — API Gateway WebSocket API for live updates
4. **Auth** — Cognito User Pool with JWT tokens, RBAC (team_lead, team_member)

## Consequences

### Positive

- Zero server management — fully serverless
- CloudFront provides global edge caching for static assets
- WebSocket API provides real-time updates without polling
- Cognito handles auth complexity (MFA, token refresh, role management)

### Negative

- Cold starts on Lambda-backed APIs (mitigated by provisioned concurrency for critical paths)
- WebSocket connections require heartbeat and reconnection logic
- SPA requires client-side routing — no SSR SEO benefits (not needed for internal tool)

### Neutral

- API Gateway provides request validation, throttling, and WAF integration
- Cost scales to zero when not in use — ideal for POC
