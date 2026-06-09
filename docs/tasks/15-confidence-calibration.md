# Task Group 15: Operator Confidence Calibration Dashboard

**Bounded Context:** Orchestration (aggregator enhancement) + Dashboard (UI)
**Internal Pattern:** Extends existing feedback aggregator + React SPA views
**Dependencies:** Task Group 13 (Feedback Loop — provides feedback-summaries data), Task Group 07 (Dashboard infrastructure)
**Design Spec:** `docs/superpowers/specs/2026-06-08-confidence-calibration-dashboard-design.md`

---

## Tasks

- [x] 16.1 Enhance feedback aggregator with calibration computation
  - Modify `src/contexts/orchestration/handlers/feedback-aggregator.ts`:
    - After computing FeedbackSummary per bucket, add calibration step
    - Group feedback entries by confidence band (0-20, 20-40, 40-60, 60-80, 80-100)
    - Calculate actual success rate per band → CalibrationPoint
    - Compute Brier score: mean squared difference between (confidence/100) and binary outcome (1=success, 0=failure)
    - Compare deviation per band against alert thresholds
    - Generate MiscalibrationAlert if threshold exceeded (info >10pts, warning >20pts, critical >30pts or 5+ consecutive high-confidence failures)
    - Compute weekly calibration time-series (last 8 weeks of Brier scores)
    - Store CalibrationData alongside existing FeedbackSummary in `feedback-summaries` table
  - _Design Spec: Sections 3.1, 3.3_

- [x] 16.2 Implement calibration alert event publishing
  - Modify feedback aggregator: when critical miscalibration detected, publish `calibration.alert-triggered` event
  - Create `contracts/events/orchestration/calibration.alert-triggered.schema.json`: alertSeverity, category, module, riskLevel, direction, deviation, suggestedAction
  - Validate schema conforms to EventEnvelope standard
  - Register in EventBridge Schema Registry
  - _Design Spec: Sections 3.3, 6.5_

- [x] 16.3 Add Communication context subscription for calibration alerts
  - Modify `terraform/contexts/communication/eventbridge.tf`: add rule subscribing to `calibration.alert-triggered` events
  - Modify `src/contexts/communication/handlers/notification-dispatcher.ts`: route critical calibration alerts to Teams/Slack, targeting team_lead recipients
  - Format notification: "⚠️ Confidence calibration alert: {module} ({risk}) is {direction} by {deviation} points. Suggested: {suggestedAction}"
  - _Design Spec: Section 6.4_

- [x] 16.4 Implement Dashboard API endpoints for calibration
  - Create `src/contexts/dashboard/api/handlers/calibration.ts`:
    - GET /calibration/summary: aggregate across all summaries, compute overall reliability scorecard (high/medium/low confidence band pass rates)
    - GET /calibration/curve: return CalibrationPoints for selected category/module/risk/period filter combination
    - GET /calibration/alerts: return all active MiscalibrationAlerts from current summaries
    - POST /calibration/alerts/:id/dismiss: mark alert as dismissed for this aggregation cycle (team_lead only)
    - GET /calibration/breakdown: return per-band detail table for selected filters
    - GET /calibration/trend: return weekly Brier score time-series for selected filters
  - Implement query parameter handling: category, module, riskLevel, period (7d, 30d, 90d)
  - Implement RBAC: all GET endpoints available to all roles, POST dismiss requires team_lead
  - Add request validation
  - _Design Spec: Sections 5_

- [x] 16.5 Add calibration API to Dashboard Terraform module
  - Modify `terraform/contexts/dashboard/lambda.tf`: add calibration handler Lambda
  - Modify `terraform/contexts/dashboard/api-gateway.tf`: add /calibration/* routes with Cognito authorizer
  - Modify `terraform/contexts/dashboard/iam.tf`: calibration Lambda needs cross-context read access to Orchestration's `feedback-summaries` table
  - _Design Spec: Section 6.2_

- [x] 16.6 Implement Reliability Scorecard view (all roles)
  - Create React component: `src/contexts/dashboard/frontend/views/CalibrationScorecard.tsx`
  - Display three summary cards: High Confidence (80-100), Medium Confidence (40-80), Low Confidence (0-40) with actual pass rate and sample size
  - Display trend indicator (last 8 weeks) showing overall calibration direction
  - Display human-readable interpretation: "When the system shows 80+ confidence, it's right X% of the time."
  - Fetch data from GET /calibration/summary
  - Accessible to all roles (no edit controls)
  - _Design Spec: Section 4.1_

- [x] 16.7 Implement Calibration Tuning view (team_lead)
  - Create React component: `src/contexts/dashboard/frontend/views/CalibrationTuning.tsx`
  - Active Alerts panel: list of MiscalibrationAlerts with severity badge, description, and action buttons (Create Steering Doc, Adjust Threshold, Dismiss)
  - Calibration Curve chart: X axis = predicted confidence, Y axis = actual success rate, ideal diagonal line overlay, actual curve plotted. Use chart library (Recharts or equivalent already in project).
  - Breakdown Filters: dropdowns for category, module, risk level, time period
  - Per-Band Detail table: band, predicted mean, actual success rate, deviation, sample size, status indicator (✓/⚠)
  - Active Guardrails display: shows computed guardrails from feedback system
  - Brier Score badge with trend arrow
  - Role-gated: only visible to team_lead
  - _Design Spec: Section 4.2_

- [x] 16.8 Implement "Create Steering Doc" quick action
  - From calibration alert, "Create Steering Doc" button opens Skills & Steering creation form (Task Group 11 UI)
  - Pre-fill form with:
    - Title: "Confidence adjustment: {module} {category} {risk}"
    - Target agent: planning
    - Content: template text with deviation, affected band, actual success rate
  - Team lead can edit before saving
  - Integrate with existing Skills & Steering API (POST /steering)
  - _Design Spec: Section 4.3_

- [x] 16.9 Add Zustand store slice and WebSocket integration
  - Create `src/contexts/dashboard/frontend/store/calibration.ts`: Zustand slice with state for summary, curve, alerts, breakdown, trend
  - Add WebSocket subscription for `calibration.alert-triggered` events: real-time alert display without page refresh
  - Implement data fetching actions with loading/error states
  - Cache filter selections in URL params for shareable links
  - _Design Spec: Sections 6.2_

- [x] 16.10 Write property tests for calibration computation
  - **RED**: Write fast-check property tests: (1) Brier score bounds — always between 0 and 1 inclusive, (2) Band completeness — output always contains exactly 5 CalibrationPoints, (3) Deviation consistency — deviation = predictedMean - actualSuccessRate, (4) Alert monotonicity — higher deviation produces same or higher severity
  - **GREEN**: Implement generators for confidence/outcome arrays and calibration inputs; run property tests and fix violations
  - **REFACTOR**: Add edge case generators (empty bands, all-success, all-failure); validate threshold boundaries
  - _Design Spec: Section 8_

---

## Wave Assignment

| Task | Wave |
|------|------|
| 16.1, 16.2 | 7 |
| 16.3, 16.4, 16.5 | 8 |
| 16.6, 16.7, 16.8, 16.9 | 9 |
| 16.10 | 8 |

---

## Dependencies on Other Enhancement Specs

- **Requires Task Group 13 (Feedback Loop)** completed first — this spec consumes the `feedback-summaries` table and extends the aggregator built in Task Group 13.
- **Requires Task Group 11 (Skills & Steering)** — the "Create Steering Doc" quick action links to the Steering management API and UI.
- **Data requirement:** Meaningful calibration requires 5+ plans per confidence band. The dashboard should gracefully show "Insufficient data" for bands with < 5 samples.
