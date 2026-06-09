# Operator Confidence Calibration Dashboard — Design Specification

**Date:** 2026-06-08
**Author:** Matt Rogers + Kiro
**Status:** Draft → Pending Approval

---

## 1. Overview

ForgeAdmin's Planning agent assigns confidence scores to proposed plans, but there's no mechanism to verify whether those scores are *accurate*. Is a 75 confidence plan actually successful 75% of the time? Without calibration visibility, operators can't trust the confidence signal, and team leads can't tune it.

This feature adds a calibration dashboard that tracks predicted confidence vs actual outcomes, surfaces miscalibration with suggested corrective actions, and provides both operators (trust-building) and team leads (tuning controls) with role-appropriate views. It builds directly on Spec 2's feedback data infrastructure.

## 2. Key Decisions

- **Audience:** Both operators (trust building via reliability scorecard) and team leads (tuning via calibration curves + actionable alerts). Role-appropriate views via existing RBAC.
- **Metrics:** Multi-dimensional calibration breakdown (by category, module, risk, time period) with automatic miscalibration detection and suggested actions.
- **Computation:** Extends existing hourly feedback aggregator (Spec 2). No new Lambda — same job, richer output.
- **Actions:** Team leads can create Steering docs, adjust thresholds, or dismiss alerts directly from calibration alerts. Pre-filled Steering doc content reduces friction.
- **Critical alerts:** Published as events, routed to Communication context for Teams/Slack notification.

## 3. Calibration Data Model

### 3.1 Calibration Addition to FeedbackSummary

```typescript
// Added to existing FeedbackSummary interface (Spec 2)
interface CalibrationData {
  calibrationCurve: CalibrationPoint[];
  brierScore: number;                    // 0 = perfect, 1 = worst
  miscalibration: MiscalibrationAlert | null;
  weeklyCalibration: {
    weekStart: string;
    brierScore: number;
    sampleSize: number;
  }[];
}

interface CalibrationPoint {
  band: string;               // "0-20", "20-40", "40-60", "60-80", "80-100"
  predictedMean: number;      // Average confidence in this band
  actualSuccessRate: number;  // Actual success % for plans in this band
  sampleSize: number;         // Plans in this band
  deviation: number;          // predictedMean - actualSuccessRate (positive = over-confident)
}

interface MiscalibrationAlert {
  severity: 'info' | 'warning' | 'critical';
  direction: 'over-confident' | 'under-confident';
  affectedBand: string;
  deviation: number;
  sampleSize: number;
  suggestedAction: string;
  steeringDocSuggestion?: {
    title: string;
    targetAgent: string;
    content: string;
  };
}
```

### 3.2 Alert Thresholds

| Condition | Severity | Suggested Action |
|-----------|----------|-----------------|
| Deviation > 10 points, sample >= 10 | info | "Consider adding Steering doc to adjust confidence for {category}" |
| Deviation > 20 points, sample >= 10 | warning | "Module {module} is {over/under}-confident by {N} points. Recommended: create Steering doc." |
| Deviation > 30 points OR 5+ consecutive failures despite high confidence | critical | "Module {module} confidence scoring is unreliable. Auto-execute should be disabled until calibrated." |

### 3.3 Aggregator Enhancement

The existing hourly aggregator (Spec 2) adds:
1. Group feedback entries by confidence band (0-20, 20-40, 40-60, 60-80, 80-100) per summary bucket
2. Calculate actual success rate per band
3. Compute Brier score: mean squared difference between predicted probability and actual outcome
4. Compare deviation against thresholds → generate alert if triggered
5. Store calibration data alongside existing summary in `feedback-summaries` table
6. If critical alert: publish `calibration.alert-triggered` event

## 4. Dashboard Views

### 4.1 Operator View — "Reliability Scorecard" (all roles)

```
┌─────────────────────────────────────────────────────────────────┐
│ System Confidence Reliability                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  At a Glance:                                                   │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐           │
│  │ High Conf    │ │ Medium Conf  │ │ Low Conf     │           │
│  │ (80-100)     │ │ (40-80)      │ │ (0-40)       │           │
│  │ ✓ 91% pass  │ │ ⚠ 68% pass  │ │ 42% pass     │           │
│  │ 47 plans    │ │ 82 plans     │ │ 12 plans     │           │
│  └──────────────┘ └──────────────┘ └──────────────┘           │
│                                                                 │
│  Trend (last 8 weeks):                                          │
│  ████████ ← overall calibration improving                       │
│                                                                 │
│  What this means:                                               │
│  "When the system shows 80+ confidence, it's right 91% of the  │
│   time. You can approve these with high trust."                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

Simple, builds trust. No tuning controls visible to operators.

### 4.2 Team Lead View — "Calibration Tuning" (team_lead role)

```
┌─────────────────────────────────────────────────────────────────┐
│ Confidence Calibration Dashboard                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ⚠ ACTIVE ALERTS (2)                                            │
│ ┌─────────────────────────────────────────────────────────────┐│
│ │ WARNING: ad-management (medium risk) is over-confident       ││
│ │ by 22 points in the 60-80 band. 15 data points.            ││
│ │ [Create Steering Doc] [Adjust Threshold] [Dismiss]          ││
│ ├─────────────────────────────────────────────────────────────┤│
│ │ INFO: dns-management (low risk) is under-confident by 12    ││
│ │ points. Auto-execute threshold could be lowered.            ││
│ │ [Create Steering Doc] [Adjust Threshold] [Dismiss]          ││
│ └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│ Calibration Curve:              │ Breakdown Filters:            │
│                                 │ [Category ▼] [Module ▼]      │
│  100%|        ·····/            │ [Risk ▼] [Time Period ▼]     │
│      |      ··  /               │                               │
│      |    ·   /                 │ Selected: ad-management       │
│  Act |  ·   /  ← ideal         │           medium risk         │
│  ual | ·  /    ← actual        │           last 90 days        │
│      |· /                       │                               │
│   0% |/                         │ Brier Score: 0.18 (fair)     │
│      └──────────── 100%         │ Trend: degrading ↓           │
│       Predicted Confidence      │                               │
│                                 │                               │
│ Per-Band Detail:                                                │
│ ┌────────┬───────────┬──────────┬───────────┬────────────────┐ │
│ │ Band   │ Predicted │ Actual   │ Deviation │ Sample Size    │ │
│ ├────────┼───────────┼──────────┼───────────┼────────────────┤ │
│ │ 0-20   │ 12%       │ 10%      │ +2 ✓     │ 5              │ │
│ │ 20-40  │ 31%       │ 28%      │ +3 ✓     │ 8              │ │
│ │ 40-60  │ 52%       │ 45%      │ +7 ✓     │ 22             │ │
│ │ 60-80  │ 71%       │ 49%      │ +22 ⚠   │ 15             │ │
│ │ 80-100 │ 88%       │ 85%      │ +3 ✓     │ 12             │ │
│ └────────┴───────────┴──────────┴───────────┴────────────────┘ │
│                                                                 │
│ Active Guardrails:                                              │
│ • ad-management/medium: ceiling 50 (5 consecutive failures)    │
│ • [Steering override: none]                                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4.3 "Create Steering Doc" Quick Action

When team lead clicks "Create Steering Doc" from an alert, the Dashboard pre-fills:
- Title: "Confidence adjustment: {module} {category} {risk}"
- Target agent: planning
- Content: "When generating confidence scores for {category} work items on module {module} at {risk} risk level, reduce your raw confidence by approximately {deviation} points. Recent data shows predictions in the {band} range succeed only {actual}% of the time."

Team lead can edit before saving. Links to existing Skills & Steering UI (Spec: skills-steering-design).

## 5. API Endpoints

```
GET    /calibration/summary              # Overall reliability scorecard (all roles)
GET    /calibration/curve                # Calibration curve data (filterable)
GET    /calibration/alerts               # Active miscalibration alerts
POST   /calibration/alerts/:id/dismiss   # Dismiss alert (team_lead only)
GET    /calibration/breakdown            # Per-band detail (filterable)
GET    /calibration/trend                # Weekly Brier score trend
```

**Query Parameters (for filterable endpoints):**
- `category` — filter by work item category
- `module` — filter by module name
- `riskLevel` — filter by risk level (low/medium/high)
- `period` — time range (7d, 30d, 90d, custom)

**RBAC:**
- `team_lead`: full access + dismiss alerts + quick action buttons
- `team_member`: read-only scorecard + calibration curve + alerts (no action buttons)

## 6. Infrastructure

### 6.1 No New Tables or Lambdas

This spec adds no new DynamoDB tables or standalone Lambdas:
- **Data source:** `feedback-summaries` table (enriched with CalibrationData by Spec 2's aggregator)
- **Alerts:** Computed by aggregator, stored in summary
- **Critical alerts:** Published as `calibration.alert-triggered` event
- **API:** New Lambda handlers for `/calibration/*` endpoints (thin read-only queries)

### 6.2 Dashboard Context Additions

- New Lambda handlers for calibration API endpoints
- New React views: Reliability Scorecard, Calibration Tuning page
- New Zustand store slice: `calibration`
- WebSocket subscription to `calibration.alert-triggered` for real-time alert display
- Integration with Skills & Steering UI for quick Steering doc creation

### 6.3 Orchestration Context Additions

- Aggregator enhancement: calibration computation added to existing hourly job
- New event publication: `calibration.alert-triggered` for critical alerts

### 6.4 Communication Context Additions

- Subscribe to `calibration.alert-triggered` — notify team leads via Teams/Slack for critical miscalibration

### 6.5 New Event Schema

```
contracts/events/orchestration/calibration.alert-triggered.schema.json
```

## 7. Error Handling

| Scenario | Behavior |
|----------|----------|
| Insufficient data for calibration (< 5 plans in any band) | Show "insufficient data" for that band. No alert generated. |
| Aggregator fails to compute calibration | Existing calibration data remains (stale but visible). Dashboard shows "last updated: X hours ago" warning. |
| Alert dismissed but condition persists | Re-surfaces after next aggregation run if still above threshold. Dismiss is per-run, not permanent. |
| Team lead creates Steering doc from alert | Alert auto-resolves on next aggregation run IF calibration improves. Otherwise persists. |
| All feedback data unavailable | Dashboard shows "Calibration data unavailable" placeholder. No crash. |

## 8. Testing Strategy

| Level | What | Approach |
|-------|------|----------|
| Unit | Brier score calculation, calibration point computation, alert threshold logic | Vitest |
| Property | Brier score always 0-1. Deviation = predicted - actual. All bands present in output. | fast-check |
| Contract | calibration.alert-triggered event schema | JSON Schema validation |
| Integration | Aggregator → calibration data → Dashboard API response | LocalStack |
| UI | Reliability Scorecard renders with mock data. Calibration curve plots correctly. | Vitest + React Testing Library |

**Property Tests:**

| Property | Description |
|----------|-------------|
| Brier score bounds | Always between 0 and 1 inclusive |
| Band completeness | Output always contains exactly 5 calibration points (one per band) |
| Deviation consistency | deviation = predictedMean - actualSuccessRate for every point |
| Alert monotonicity | Higher deviation always produces same or higher severity |

## 9. Execution Order

| Task | Wave | Description |
|------|------|-------------|
| Aggregator enhancement (calibration computation) | 7 | Extends Spec 2's aggregator |
| calibration.alert-triggered event schema | 8 | Contract |
| Calibration API endpoints (Dashboard) | 8 | Thin query handlers |
| Communication subscription for critical alerts | 8 | Notification routing |
| Dashboard UI: Reliability Scorecard | 9 | Operator view |
| Dashboard UI: Calibration Tuning + alerts | 9 | Team lead view |
| Steering Doc quick-action integration | 9 | Links to Skills & Steering UI |
| Property tests | 8 | Correctness validation |

## 10. Relationship to Other Enhancement Specs

- **Spec 2 (Feedback Loop):** This spec is the visibility layer for Spec 2's data. It consumes `feedback-summaries` (enriched with calibration data) and displays it. No new data collection — pure presentation + alerting.
- **Skills & Steering:** The "Create Steering Doc" quick action links directly to the Steering management UI. Calibration alerts suggest specific Steering doc content to fix miscalibration.
- **Spec 3 (Dry-Run):** Simulation prediction accuracy (static analysis predicted X, actual was Y) can feed into calibration in a future enhancement — tracking not just confidence accuracy but also diff prediction accuracy.
