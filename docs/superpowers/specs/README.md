# ForgeAdmin Design Specifications

Feature design specs documenting major capabilities added to the platform.

## Index

| Date | Specification | Focus |
|------|--------------|-------|
| 2026-06-08 | [Incident Correlation & Pattern Detection](./2026-06-08-incident-correlation-pattern-detection-design.md) | Temporal, causal, infrastructure, and repeat pattern correlation engine |
| 2026-06-08 | [Feedback Loop & Continuous Learning](./2026-06-08-feedback-loop-continuous-learning-design.md) | Capture outcomes, aggregate feedback, adjust confidence |
| 2026-06-08 | [Confidence Calibration Dashboard](./2026-06-08-confidence-calibration-dashboard-design.md) | Calibration curves, threshold tuning, per-module metrics |
| 2026-06-08 | [Dry-Run Simulation Mode](./2026-06-08-dry-run-simulation-mode-design.md) | Sandbox execution without side effects for validation |
| 2026-06-08 | [Playbook Composition](./2026-06-08-playbook-composition-design.md) | Multi-step playbook expansion and composition engine |
| 2026-06-08 | [Skills & Steering](./2026-06-08-skills-steering-design.md) | Configurable agent skills and prompt steering infrastructure |
| 2026-06-08 | [Architecture Refactor](./2026-06-08-forgeadmin-architecture-refactor-design.md) | Hexagonal architecture adoption for complex contexts |
| 2026-06-09 | [Production Maturity Roadmap](./2026-06-09-production-maturity-roadmap-design.md) | 4-phase deployment plan: Lights On → Brain Online → Bridge Building → Go Live |

## Conventions

- File naming: `{YYYY-MM-DD}-{feature-slug}-design.md`
- All specs are authored by Matt Rogers + Kiro
- Specs reference the relevant ADRs and contract files where applicable
