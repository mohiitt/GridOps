# DESIGN.md — GridOps Copilot

**Tagline:** From renewable-energy alert noise to actionable incident intelligence.

**Hackathon:** TrueFoundry × CrewAI — *From Prototype to Production: Real-World AI Agents*

This is the implementation-ready frontend specification. A building agent can implement a polished, demo-ready web app directly from this document. It is aligned with `IMPLEMENTATION_PLAN.md` (backend): same site (`SITE-DS-001`), same scenarios, same incident/agent/trace schemas, same energy price ($75/MWh), and the same 9-agent CrewAI workflow.

> Frontend = one person. Backend = one person. The frontend ships with static JSON fixtures so it works with **zero backend dependency**, then optionally points at the real APIs (ports: incident_api `8000`, anomaly `8001`, ingestion `8002`, crew `8003`).

---

## 0. Locked Frontend Decisions

| Decision | Choice |
| --- | --- |
| Framework | **Next.js 14 (App Router) + React 18 + TypeScript** |
| Styling | **Tailwind CSS** (light-mode-first, single theme) |
| Icons | **Lucide React** |
| Charts | **Recharts** |
| State | React Context + hooks (`ScenarioProvider`). No Redux. |
| Data | **Static JSON fixtures** in `/data` first; async `api.ts` layer simulates network with `await delay()`. |
| Fonts | **Inter** (UI), **JetBrains Mono** (metrics/IDs/code), tabular numbers for all metrics |
| Routing | App Router routes under `/(app)` with shared layout |
| Backend toggle | `NEXT_PUBLIC_USE_LIVE_API` env flag; default `false` (fixtures) |
| No backend required for MVP | Demo must run fully on fixtures |

---

## 1. Product Overview

- **Product name:** GridOps Copilot
- **Tagline:** From renewable-energy alert noise to actionable incident intelligence.
- **One-line pitch:** An AI operations copilot that compresses thousands of disconnected SCADA/telemetry alerts into a small set of explainable, prioritized incidents with root cause, evidence, business impact, recommended action, and human-approval governance.
- **Problem statement:** Renewable-energy operators are flooded with low-level signals from SCADA, telemetry, CMMS, weather, and grid-dispatch systems. The bottleneck is not data; it is actionable understanding. Existing tools answer *"what happened?"* GridOps Copilot answers *"why, how severe, what's the evidence, what's the business impact, what should I do, and does this need approval?"*
- **Target users:** Renewable-energy control-room operators, site engineers, asset-performance managers, and operations leads managing large solar + BESS portfolios.
- **User goals:** Triage faster, trust AI reasoning, avoid alert fatigue, prioritize by business impact, and act safely with human-in-the-loop governance.
- **Business value:** Reduced mean-time-to-triage, fewer missed high-impact failures, quantified revenue protection ($/day at risk), and an auditable, governed decision trail.
- **Why it is not just a chatbot:** It is an operational dashboard. Output is structured incidents with telemetry charts, evidence cards, governance gates, audit trails, and an evaluation harness — not a chat transcript. The AI is decision *support*, never autonomous grid control.
- **Why it fits the hackathon theme:** It is a real-world use case with multi-agent orchestration (CrewAI, visibly traced), production AI infrastructure (TrueFoundry observability: gateway traces, cost, latency, routing, health), reliability/evaluation (eval screen with ground-truth pass/fail), and governance/safe deployment (human approval before any operational action).

---

## 2. Design Principles

1. **Alert compression over alert display.** The hero UX is *N raw alerts → 1 incident*. Never show a raw alert firehose as the primary view.
2. **Evidence before recommendation.** Every recommendation is backed by visible, sourced evidence cards and telemetry. No unexplained verdicts.
3. **Human approval before operational action.** Any action that touches an asset (offline, isolate, dispatch) is gated behind an explicit approval control.
4. **Make AI reasoning inspectable.** The CrewAI agent pipeline is a first-class screen: each agent's input, output, model, latency, cost, confidence.
5. **Production telemetry must be visible.** TrueFoundry observability (gateway calls, routing, cost, latency, health, fallbacks) is shown, not hidden.
6. **Prioritize operator speed and trust.** High-signal layout, scannable priority queue, sticky action panel, keyboard-reachable controls.
7. **Avoid black-box decisions.** Confidence is always shown; low confidence triggers visible escalation.
8. **Calm under pressure.** Light, precise, enterprise aesthetic. Severity communicated with color + icon + label, never alarmist.

---

## 3. Visual Design System: Light Mode

### 3.1 Color tokens (Tailwind `theme.extend.colors`)

```js
colors: {
  bg: { base: "#F8FAFC", surface: "#FFFFFF", subtle: "#F1F5F9" },
  border: { base: "#E2E8F0", strong: "#CBD5E1" },
  text: { main: "#0F172A", secondary: "#334155", muted: "#64748B", faint: "#94A3B8" },
  brand: { primary: "#0EA5E9", secondary: "#10B981", deep: "#0369A1" },
  severity: {
    critical: "#EF4444",
    high: "#F97316",
    medium: "#F59E0B",
    low: "#22C55E",
    info: "#3B82F6",
  },
}
```

### 3.2 Severity surface variants (for badges/cards — tint + text + border)

| Severity | text/icon | background tint | border |
| --- | --- | --- | --- |
| critical | `#B91C1C` | `#FEF2F2` | `#FECACA` |
| high | `#C2410C` | `#FFF7ED` | `#FED7AA` |
| medium | `#B45309` | `#FFFBEB` | `#FDE68A` |
| low | `#15803D` | `#F0FDF4` | `#BBF7D0` |
| info | `#1D4ED8` | `#EFF6FF` | `#BFDBFE` |

Status colors for `MetricCard.status`: `critical → severity.critical`, `warning → severity.medium`, `success → brand.secondary`, `neutral → text.muted`.

### 3.3 Chart colors

- Primary series: `#0EA5E9` (brand.primary)
- Comparison/forecast series: `#94A3B8` (dashed)
- Threshold line: `#EF4444` (dashed)
- Secondary metric: `#10B981`
- Tertiary: `#8B5CF6`
- Grid lines: `#E2E8F0`; axis text: `#64748B`
- Anomaly highlight band: `rgba(239,68,68,0.08)`

### 3.4 Typography

- **Primary:** Inter — weights 400/500/600/700. Load via `next/font/google`.
- **Monospace:** JetBrains Mono — IDs, metric values, latency/cost, code/JSON.
- **Tabular numbers:** apply `font-variant-numeric: tabular-nums` (Tailwind `tabular-nums`) to all metric values so digits align.

Type scale:

| Token | size / line | weight | use |
| --- | --- | --- | --- |
| display | 30/36 | 700 | KPI hero values |
| h1 | 24/32 | 600 | page titles |
| h2 | 18/28 | 600 | section headers |
| h3 | 15/22 | 600 | card titles |
| body | 14/22 | 400 | default |
| small | 13/18 | 400 | secondary |
| caption | 12/16 | 500 | labels, badges |
| mono-metric | 14–28 | 500 | numeric values |

### 3.5 Spacing, radius, shadows, icons

- **Spacing scale:** 4px base — use 4, 8, 12, 16, 20, 24, 32, 48. Page gutter 24px; card padding 20px; section gap 24px.
- **Radius:** `sm 6px`, `md 10px` (cards/inputs default), `lg 14px` (panels), `full` (badges/pills).
- **Shadows (soft, enterprise):**
  - `shadow-card`: `0 1px 2px rgba(15,23,42,0.04), 0 1px 3px rgba(15,23,42,0.06)`
  - `shadow-pop`: `0 4px 12px rgba(15,23,42,0.08)` (dropdowns, hovered incident)
  - `shadow-sticky`: `0 -1px 0 rgba(226,232,240,1)` for top borders of sticky panels
- **Borders:** 1px `border.base` default, `border.strong` on hover/active.
- **Icons:** Lucide, 1.75px stroke, 16px inline / 18px nav / 20px headers. Pair every severity color with an icon (see Accessibility §14).

---

## 4. Information Architecture

All routes live under a shared app shell. `Assets`, `Telemetry`, and `Maintenance` are present in the sidebar; the seven graded routes below are the core deliverables.

| Route | Purpose | Main sections | Primary action | Data shown |
| --- | --- | --- | --- | --- |
| `/command-center` | Operational home; triage at a glance | KPI cards, Incident Priority Queue, Selected Incident Brief, Alert Compression viz, AI status | **Run AI Analysis** / select incident | KPIs, incidents[], alerts→incident grouping for active scenario |
| `/incidents` | Full incident list, filter/sort | Filter bar, incident table | Open an incident | incidents[] (all) |
| `/incidents/:id` | Deep incident investigation + action | Hero, root-cause narrative, telemetry charts, evidence timeline, evidence cards, business impact, sticky action panel, governance warning | Approve / Create work order / Escalate / False positive | one Incident + evidence[] + telemetry series + governance |
| `/ai-workflow` | CrewAI multi-agent orchestration trace | Pipeline graph of 9 agents, per-agent detail drawer, totals | Inspect an agent node | agentTraces[] for selected incident |
| `/observability` | TrueFoundry production readiness | Gateway summary, model routing table, inference health, request trace timeline, cost/latency, fallback status, audit logs | Inspect a trace | trueFoundryTraces[], service health metrics |
| `/governance` | Human-in-the-loop rules & audit | Approval rules, pending approvals, audit trail, allowed vs restricted actions | Approve/reject pending | governanceRules[], pending approvals, auditTrail[] |
| `/evaluation` | Reliability vs ground truth | Summary metrics, per-scenario results table, expected vs predicted | Re-run evaluation (simulated) | evaluationCases[], aggregate metrics |

Also: `Assets` (asset inventory table), `Telemetry` (asset telemetry explorer), `Maintenance` (CMMS records) — implement as lightweight table views from fixtures if time allows; not part of the core graded path.

---

## 5. Global Layout

App shell = fixed left sidebar + sticky top header + scrollable main content.

### 5.1 Left sidebar (240px, collapsible to 64px)

- Brand lockup at top: GridOps Copilot wordmark + small bolt/grid mark in `brand.deep`.
- Nav items (Lucide icons): **Command Center** (`LayoutDashboard`), **Incidents** (`AlertTriangle`), **Assets** (`Boxes`), **Telemetry** (`Activity`), **Maintenance** (`Wrench`), **AI Workflow** (`Workflow`), **Observability** (`Gauge`), **Governance** (`ShieldCheck`), **Evaluation** (`CheckCircle2`).
- Active item: `bg-subtle` fill, `brand.deep` text, 2px left accent bar in `brand.primary`.
- Footer: facility name + "GridOps AI Online" mini status dot.

### 5.2 Top header (sticky, 64px, `bg-surface`, bottom `border-base`)

Left → right:
1. **Page title** (h1) — derived from route.
2. **Facility selector** (dropdown): `Desert Sun Solar + BESS — 500 MW` (single option for MVP; styled as a real selector).
3. **Scenario selector** (segmented dropdown) — *the most important control*: `Normal Operation`, `Inverter Cooling Degradation`, `BESS Thermal Risk`. (Optional 4th: `Weather False Positive`.) Changing it re-renders all data instantly.
4. **Time range selector**: `Last 6 hours` (options: 1h, 6h, 24h; default 6h).
5. **AI status pill**: green dot + `GridOps AI Online` (mono). Turns amber `Analyzing…` during a run.
6. **Run AI Analysis** button (primary, `brand.primary`, `Sparkles` icon). Triggers the staged agent run (see §11).

### 5.3 Main content area

- Max width 1440px, centered, 24px gutters. 12-column grid where needed.
- Page header row (title + contextual actions) then content sections with 24px vertical rhythm.

### 5.4 Responsive behavior

- **≥1280px:** full layout (sidebar + multi-column).
- **1024–1279px:** sidebar collapses to icon rail; incident detail right panel drops below main column.
- **<1024px:** sidebar becomes a top drawer (hamburger); tables become horizontally scrollable cards; KPI cards wrap 2-per-row. Demo target is desktop (≥1280px).

---

## 6. Demo Scenarios

Scenario selection swaps the entire fixture set via `ScenarioProvider`. Three required scenarios (+ optional D).

### Scenario A — Normal Operation
- No critical/high incident. One **low** info incident.
- KPIs: Active Incidents `1 (low)`, Energy at Risk `0.2 MWh/day`, Human Approvals Pending `0`.
- Recommendation: **Continue monitoring**. Approval required: **No**.
- Alert compression: minimal (0–1 chips). AI verdict: `normal_operation`.

### Scenario B — Inverter Cooling Degradation (hero demo)
- Incident ID `INC-1042`, Asset `Solar Inverter INV-042`, Site `Desert Sun Solar + BESS`.
- Severity **High**, Confidence **82%**, Root cause **Cooling Subsystem Degradation**.
- Grouped alerts **12 → 1 incident**.
- Energy impact **2.8 MWh/day**, Revenue impact **$210/day**.
- Recommended action **Inspect cooling fan within 24 hours**.
- Governance: **Human approval required before taking inverter offline**.

### Scenario C — BESS Thermal Risk
- Incident ID `INC-2091`, Asset `BESS Unit BESS-011`.
- Severity **Critical**, Confidence **88%**, Root cause **Thermal Management System Degradation**.
- Grouped alerts **16 → 1 incident**.
- Energy impact **6.4 MWh/day**, Revenue impact **$480/day**.
- Recommended action **Escalate to site engineer and inspect cooling loop immediately**.
- Governance: **Human approval required before continued dispatch or asset isolation**.

> Note: backend ground truth keeps BESS energy-impact range broad; the frontend fixture uses the concrete demo values above (`6.4 MWh/day`, `$480/day`) for a crisp story.

---

## 7. Screen Specifications

### 7.1 Command Center (`/command-center`)

Grid: KPI row (full width) → two-column body (left 64% queue + compression, right 36% selected brief).

**KPI cards** (5, using `MetricCard`):

| # | label | value (Scenario B) | status |
| --- | --- | --- | --- |
| 1 | Active Incidents | `1` (subtext "1 high") | warning |
| 2 | Alerts Correlated | `12 → 1` | neutral |
| 3 | Energy at Risk | `2.8 MWh/day` (subtext "$210/day") | warning |
| 4 | Mean Triage Time | `1.9 min` (trend "↓ 64%") | success |
| 5 | Human Approvals Pending | `1` | critical |

**Incident Priority Queue** (table, sorted by severity then energy impact). Columns: Severity (badge), Incident ID (mono), Asset, Root Cause, Confidence (bar + %), Energy Impact, Recommended Action, Approval (badge), Status (pill). Row hover → `shadow-pop`; click → opens `/incidents/:id`. Selecting a row (single click) populates the right-side brief; double click or "Open" navigates.

**Selected Incident Brief** (right panel, `IncidentCard` expanded):
- Severity badge + Incident ID + asset.
- Root cause (h3) + confidence.
- Evidence bullets (top 3–4, from evidence[]).
- Recommended action (highlighted).
- Business impact (energy + revenue, mono).
- Human approval badge (`ShieldAlert` if required).
- Buttons: **Open Incident** (→ detail), **View AI Workflow** (→ `/ai-workflow?incident=ID`), **View TrueFoundry Trace** (→ `/observability?incident=ID`).

**Alert Compression Visualization** (signature component, below queue):
- Left column: raw alert chips (severity-tinted pills) for the active scenario. For B: `Inverter temperature high`, `Efficiency drop`, `Output below forecast`, `Voltage instability`, `Communication timeout`, `Cooling fan speed irregular`, `Performance degradation` (show count `12 raw alerts`).
- Animated convergence: chips flow via connector lines into one **incident card** on the right (`12 raw alerts → 1 actionable incident`). Use Framer Motion or CSS transitions; respect reduced-motion (instant if disabled).
- Caption under arrow: `Compression ratio 12:1`.

**AI analysis status:** while a run is active, show an inline progress strip naming the current agent (mirrors §11). When idle, show last-run timestamp + total latency/cost summary linking to observability.

**Scenario selector behavior:** changing scenario instantly re-renders KPIs, queue, brief, and compression viz with that scenario's fixtures (no full reload).

### 7.2 Incident Detail (`/incidents/:id`)

Layout: full-width **hero header**, then left 65% / right 35% (right is sticky).

**Hero header:** severity badge + Incident ID (mono) + title (e.g., "Cooling subsystem degradation on Solar Inverter INV-042"). Sub-row: asset · site · created time · status pill · confidence. Right of hero: compact KPIs (energy impact, revenue impact, grouped alerts).

**Left column (65%):**
1. **Root cause narrative** — 2–4 sentence AI-written summary (from incident.operatorBriefing/rootCause). Calm, factual.
2. **Telemetry charts** (`TelemetryChart`, Recharts):
   - For B: `Inverter Temperature (°C)` with threshold line 85, `Cooling Fan RPM`, `Active Power (kW)` with forecast comparison series, `Conversion Efficiency (%)`.
   - For C: `Battery Temperature (°C)` threshold 50, `Cooling Loop Temp (°C)`, `State of Charge (%)`, `Discharge Power (kW)`.
   - Highlight the anomaly window with a tinted band; mark where temperature rises *before* output drops.
3. **Evidence timeline** — horizontal time-ordered markers showing the causal sequence (temp rise → efficiency drop → output below forecast → comms timeout) with timestamps.
4. **Supporting evidence cards** (`EvidenceCard` grid) — maintenance history (similar issue 8 months ago), manufacturer bulletin (fan risk >18,000h), weather context (weather does not explain loss), asset spec (runtime threshold), operating procedure. Each shows sourceType icon, title, summary, relevance score, timestamp.

**Right column (35%, sticky `ActionPanel`):**
- **Recommended action** (prominent).
- **Governance warning banner** (amber/red): e.g., "Human approval required before taking inverter offline."
- Approval status badge + approver (`Site Engineer`).
- Action buttons (stacked):
  - **Approve Inspection** (primary)
  - **Create Work Order**
  - **Escalate to Site Engineer**
  - **Mark as False Positive** (subtle/danger-outline)
- **Audit summary** mini-list (latest audit events for this incident).
- Links: **View AI Workflow**, **View TrueFoundry Trace**.

Button behaviors per §11 (status changes, toasts, audit append, modal).

### 7.3 AI Workflow (`/ai-workflow`)

Purpose: make CrewAI orchestration visible. Reads `agentTraces[]` for the selected incident (query param `?incident=` or last analyzed).

**Pipeline display:** vertical/horizontal directed graph of agents in execution order with connectors:
1. Alert Correlation Agent
2. Telemetry Analysis Agent
3. Maintenance History Agent
4. Weather/Forecast Agent
5. Root Cause Agent
6. Business Impact Agent
7. Safety/Governance Agent
8. Operator Briefing Agent

> (Backend defines 9 agents incl. *Maintenance Recommendation Agent*. Frontend pipeline shows the 8 listed; if the live API returns 9, render all returned nodes — do not hardcode the count.)

Each node = `AgentTraceNode` showing: agent name, role, status (pending/running/complete/warning/failed with icon+color), input summary, output summary, model used (mono, e.g., `gpt-4o-mini`), latency (ms), cost ($), confidence (if present). Status drives node styling; the chain animates left-to-right during a run (sequential reveal).

**Totals bar** (top): total agents, total latency, total cost, overall confidence — links to Observability.

**Detail drawer:** clicking a node opens a side drawer with the full input/output JSON (mono, syntax-tinted) and the agent's reasoning summary.

### 7.4 Observability (`/observability`)

Purpose: TrueFoundry production readiness. Datadog-style.

**AI Gateway Summary** (KPI row): Total model calls `18`, Total latency `11.4s`, Estimated cost `$0.042`, Failed calls `0`, Fallbacks triggered `0`.

**Model routing table:** columns — Agent/Caller, Requested model, Routed model, Provider, Calls, Avg latency, Cost, Status. Rows map agents → `gpt-4o-mini` (and Operator Briefing → `gpt-4o`).

**Inference service health card:** Service `renewable-anomaly-service`, p95 latency `220ms`, endpoint health `Healthy` (green), uptime, replicas, CPU/mem mini-bars.

**Request trace timeline:** Gantt-style horizontal bars per model call across the workflow (start offset + duration), colored by status (success/fallback/failed). Hover → tooltip with latency/cost/model.

**Cost & latency metrics:** small line/bar charts — cost per call, latency distribution, p50/p95/p99.

**Failure/fallback status:** card showing `0 failures, 0 fallbacks`, with a sample fallback rule explanation ("If primary model latency > 5s or 5xx, route to fallback model").

**Gateway audit logs:** scrollable mono log list (timestamp, caller, model, latency, cost, status) — last ~18 entries from `trueFoundryTraces[]`.

### 7.5 Governance (`/governance`)

**Approval rules** (`governanceRules[]` table/cards): name, condition, action, severity, triggered badge. Required rules:
- If safety risk is critical → human approval required.
- If action involves taking asset offline → human approval required.
- If confidence < 70% → escalate to engineer.
- If BESS thermal risk detected → critical escalation required.

**Pending approvals:** list of incidents awaiting human decision (Scenario B/C show 1 each) with inline **Approve** / **Reject** buttons → append audit event + toast.

**Audit trail:** chronological, immutable-styled log (mono) of governance actions: `approval_requested`, `approved`, `rejected`, `escalated`, `workorder_created`, `acknowledged` — each with actor, timestamp, incident, reason.

**Allowed vs Restricted actions** (two-column panel):
- *Restricted (require approval / blocked for AI):* Take asset offline · Modify inverter settings · Dispatch crews without approval · Change grid interconnection parameters.
- *Allowed (AI may perform):* Recommend inspection · Create draft work order · Notify operator · Generate incident report.

**Human-in-the-loop explanation:** short callout: "GridOps Copilot is decision support. It never executes operational actions on grid assets. All physical actions require human approval and are simulated in this demo."

### 7.6 Evaluation (`/evaluation`)

**Summary metrics row** (`MetricCard`): Root cause match `3/3`, Priority accuracy `100%`, Action recommendation match `3/3`, False escalation rate `0%`, Avg workflow latency `14.2s`, Avg cost per incident `$0.039`.

**Per-scenario results table** (`evaluationCases[]`): columns — Scenario, Expected Root Cause, Predicted Root Cause, Priority (expected/predicted), Action match, Result (pass/fail/partial badge). Green check rows for passes.

**Expected vs predicted detail:** expandable row showing side-by-side expected vs predicted for root cause, priority, action; mismatches highlighted.

**Re-run evaluation** button: simulated; shows progress then refreshes results (deterministic pass for the three scenarios).

---

## 8. Component Library

All components in `/components`, typed, Tailwind-styled, light-mode, accessible (icon + label for severity).

### StatusBadge
```ts
type StatusBadgeProps = {
  severity: "critical" | "high" | "medium" | "low" | "info";
  label: string;
};
```
Pill with severity tint (§3.2) + Lucide icon (critical `OctagonAlert`, high `AlertTriangle`, medium `AlertCircle`, low `CheckCircle2`, info `Info`) + label. `aria-label` includes severity.

### MetricCard
```ts
type MetricCardProps = {
  label: string;
  value: string;
  subtext?: string;
  trend?: string;
  status?: "critical" | "warning" | "success" | "neutral";
};
```
`bg-surface`, `shadow-card`, radius md. Label (caption, muted), value (mono-metric, tabular), subtext (small muted), trend (colored by direction). Left status accent bar by `status`.

### IncidentCard
```ts
type IncidentCardProps = {
  id: string;
  asset: string;
  rootCause: string;
  severity: "critical" | "high" | "medium" | "low";
  confidence: number;            // 0..1
  energyImpact: string;
  status: string;
};
```
Header: severity badge + id (mono). Body: asset, rootCause, confidence bar, energyImpact. Footer: status pill. Hover `shadow-pop`, clickable.

### AgentTraceNode
```ts
type AgentTraceNodeProps = {
  agentName: string;
  role: string;
  status: "pending" | "running" | "complete" | "warning" | "failed";
  inputSummary: string;
  outputSummary: string;
  model: string;
  latencyMs: number;
  costUsd: number;
  confidence?: number;
};
```
Card node with status icon (pending `Circle`, running spinner `Loader2`, complete `CheckCircle2`, warning `AlertTriangle`, failed `XCircle`). Shows role, input/output summaries (truncated, expandable), model (mono chip), latency, cost, confidence bar. Connector arrows between nodes.

### EvidenceCard
```ts
type EvidenceCardProps = {
  sourceType: "maintenance" | "manufacturer" | "weather" | "asset_spec" | "procedure";
  title: string;
  summary: string;
  relevanceScore: number;        // 0..1
  timestamp?: string;
};
```
Source icon (maintenance `Wrench`, manufacturer `FileText`, weather `CloudSun`, asset_spec `Cpu`, procedure `ClipboardList`) + source label chip, title, summary, relevance meter, optional timestamp.

### TelemetryChart
```ts
type TelemetryChartProps = {
  title: string;
  metric: string;
  unit: string;
  threshold?: number;
  series: Array<{ timestamp: string; value: number }>;
  comparisonSeries?: Array<{ timestamp: string; value: number }>;
};
```
Recharts `LineChart`. Primary series brand.primary; comparison dashed muted; threshold = red dashed `ReferenceLine`. Tooltip with formatted value + unit. Y-axis unit label. Below chart: one-line text summary of trend (Accessibility §14).

### ActionPanel
```ts
type ActionPanelProps = {
  recommendedAction: string;
  approvalRequired: boolean;
  approver: string;
  status: string;
};
```
Sticky card. Recommended action (prominent), governance banner if `approvalRequired`, approver, status badge, stacked action buttons (Approve Inspection / Create Work Order / Escalate / Mark as False Positive).

Additional supporting components: `ScenarioSelector`, `SidebarNav`, `TopHeader`, `KpiRow`, `IncidentTable`, `AlertChip`, `AlertCompression`, `Toast`, `Modal`, `Drawer`, `ConfidenceBar`, `AuditList`, `RoutingTable`, `TraceTimeline`.

---

## 9. Data Model

`/types/index.ts` — shared with fixtures and the API layer.

```ts
type Severity = "critical" | "high" | "medium" | "low" | "info";

type IncidentStatus =
  | "new" | "analyzing" | "awaiting_review"
  | "approved" | "work_order_created" | "closed";

type ScenarioId = "normal" | "inverter_cooling" | "bess_thermal" | "weather_fp";

interface Incident {
  id: string;
  title: string;
  assetId: string;
  assetName: string;
  assetType: string;
  site: string;
  severity: Severity;
  status: IncidentStatus;
  rootCause: string;
  rootCauseNarrative: string;   // 2-4 sentence operator briefing
  confidence: number;           // 0..1
  groupedAlertCount: number;
  energyImpactMWhPerDay: number;
  revenueImpactPerDay: number;
  recommendedAction: string;
  approvalRequired: boolean;
  approver: string;
  createdAt: string;            // ISO-8601 Z
  evidenceIds: string[];
  telemetrySeriesIds: string[];
  alertIds: string[];
}

interface Alert {
  id: string;
  timestamp: string;
  assetId: string;
  severity: Severity;
  source: "SCADA" | "BESS" | "Inverter" | "Weather" | "CMMS" | "Grid";
  alertType: string;            // controlled vocab (matches backend §8)
  message: string;
  groupedIntoIncidentId?: string;
}

interface Asset {
  id: string;
  name: string;
  type: "Solar Inverter" | "BESS Unit" | "Transformer" | "Substation" | "Weather Station";
  site: string;
  capacityMw?: number;
  runtimeHours?: number;
  status: "healthy" | "warning" | "critical" | "offline";
}

interface TelemetryPoint { timestamp: string; value: number; }

interface TelemetrySeries {
  id: string;
  incidentId: string;
  metric: string;               // e.g. "inverter_temperature_c"
  title: string;
  unit: string;
  threshold?: number;
  series: TelemetryPoint[];
  comparisonSeries?: TelemetryPoint[];  // forecast/expected
}

interface Evidence {
  id: string;
  incidentId: string;
  sourceType: "maintenance_history" | "manufacturer_bulletin"
    | "weather_context" | "asset_spec" | "operating_procedure";
  title: string;
  summary: string;
  relevanceScore: number;       // 0..1
  timestamp?: string;
}

interface AgentTrace {
  id: string;
  incidentId: string;
  order: number;
  agentName: string;
  role: string;
  status: "pending" | "running" | "complete" | "warning" | "failed";
  inputSummary: string;
  outputSummary: string;
  model: string;
  latencyMs: number;
  costUsd: number;
  confidence?: number;
}

interface TrueFoundryTrace {
  id: string;
  incidentId: string;
  caller: string;               // agent name
  service: string;
  model: string;
  routedModel: string;
  provider: string;
  endpoint: string;
  latencyMs: number;
  costUsd: number;
  status: "success" | "failed" | "fallback";
  timestamp: string;
}

interface GovernanceRule {
  id: string;
  name: string;
  condition: string;
  triggered: boolean;
  action: string;
  severity: Severity;
}

interface AuditEvent {
  id: string;
  incidentId: string;
  timestamp: string;
  actor: string;
  action: "approval_requested" | "approved" | "rejected"
    | "escalated" | "workorder_created" | "acknowledged";
  reason?: string;
}

interface EvaluationCase {
  scenario: string;
  expectedRootCause: string;
  predictedRootCause: string;
  expectedPriority: Severity;
  predictedPriority: Severity;
  expectedAction: string;
  predictedAction: string;
  result: "pass" | "fail" | "partial";
}

interface ScenarioBundle {
  scenarioId: ScenarioId;
  label: string;
  kpis: Record<string, { value: string; subtext?: string; trend?: string; status?: string }>;
  incidents: Incident[];
  alerts: Alert[];
  evidence: Evidence[];
  telemetry: TelemetrySeries[];
  agentTraces: AgentTrace[];
  trueFoundryTraces: TrueFoundryTrace[];
  governanceRules: GovernanceRule[];
  auditTrail: AuditEvent[];
  evaluationCases: EvaluationCase[];
}
```

---

## 10. Sample Data

`/data/scenarios.ts` exports one `ScenarioBundle` per scenario. Representative fixtures below (synthetic, demo-tuned, consistent with backend).

### 10.1 Incident — INC-1042 (Scenario B)
```json
{
  "id": "INC-1042",
  "title": "Cooling subsystem degradation on Solar Inverter INV-042",
  "assetId": "INV-042",
  "assetName": "Solar Inverter INV-042",
  "assetType": "Solar Inverter",
  "site": "Desert Sun Solar + BESS",
  "severity": "high",
  "status": "awaiting_review",
  "rootCause": "Cooling Subsystem Degradation",
  "rootCauseNarrative": "INV-042 shows progressive cooling subsystem degradation. Inverter temperature rose ahead of an output decline, conversion efficiency fell below normal range, and actual output dropped below the weather-adjusted forecast. Weather does not explain the loss. A similar cooling-fan issue occurred 8 months ago and runtime now exceeds the 18,000-hour fan-risk threshold.",
  "confidence": 0.82,
  "groupedAlertCount": 12,
  "energyImpactMWhPerDay": 2.8,
  "revenueImpactPerDay": 210,
  "recommendedAction": "Inspect cooling fan within 24 hours",
  "approvalRequired": true,
  "approver": "Site Engineer",
  "createdAt": "2026-06-16T14:40:00Z",
  "evidenceIds": ["EV-1042-1","EV-1042-2","EV-1042-3","EV-1042-4","EV-1042-5"],
  "telemetrySeriesIds": ["TS-1042-temp","TS-1042-fan","TS-1042-power","TS-1042-eff"],
  "alertIds": ["ALT-1042-01","ALT-1042-02","ALT-1042-03"]
}
```

### 10.2 Incident — INC-2091 (Scenario C)
```json
{
  "id": "INC-2091",
  "title": "Thermal management system degradation on BESS Unit BESS-011",
  "assetId": "BESS-011",
  "assetName": "BESS Unit BESS-011",
  "assetType": "BESS Unit",
  "site": "Desert Sun Solar + BESS",
  "severity": "critical",
  "status": "awaiting_review",
  "rootCause": "Thermal Management System Degradation",
  "rootCauseNarrative": "BESS-011 battery and cooling-loop temperatures are rising during an active grid dispatch. State-of-charge behavior is abnormal and a cooling-loop warning has escalated toward critical. Safety risk is elevated; immediate cooling-loop inspection and engineer escalation are required before continued dispatch.",
  "confidence": 0.88,
  "groupedAlertCount": 16,
  "energyImpactMWhPerDay": 6.4,
  "revenueImpactPerDay": 480,
  "recommendedAction": "Escalate to site engineer and inspect cooling loop immediately",
  "approvalRequired": true,
  "approver": "Site Engineer",
  "createdAt": "2026-06-16T14:42:00Z",
  "evidenceIds": ["EV-2091-1","EV-2091-2","EV-2091-3"],
  "telemetrySeriesIds": ["TS-2091-batt","TS-2091-loop","TS-2091-soc","TS-2091-dis"],
  "alertIds": ["ALT-2091-01","ALT-2091-02","ALT-2091-03"]
}
```

### 10.3 Normal Operation incident (Scenario A)
```json
{
  "id": "INC-0007",
  "title": "Nominal operation — minor weather variation",
  "assetId": "SITE-DS-001",
  "assetName": "Desert Sun Solar + BESS",
  "assetType": "Site",
  "site": "Desert Sun Solar + BESS",
  "severity": "low",
  "status": "new",
  "rootCause": "Normal Operation",
  "rootCauseNarrative": "All assets operating within normal ranges. Minor output variation is fully explained by weather. No equipment anomaly detected.",
  "confidence": 0.94,
  "groupedAlertCount": 1,
  "energyImpactMWhPerDay": 0.2,
  "revenueImpactPerDay": 15,
  "recommendedAction": "Continue monitoring",
  "approvalRequired": false,
  "approver": "—",
  "createdAt": "2026-06-16T14:40:00Z",
  "evidenceIds": ["EV-0007-1"],
  "telemetrySeriesIds": ["TS-0007-power"],
  "alertIds": ["ALT-0007-01"]
}
```

### 10.4 Alerts (Scenario B sample)
```json
[
  {"id":"ALT-1042-01","timestamp":"2026-06-16T13:30:00Z","assetId":"INV-042","severity":"medium","source":"Inverter","alertType":"inverter_temperature_high","message":"Inverter temperature 78.4C exceeds 75C","groupedIntoIncidentId":"INC-1042"},
  {"id":"ALT-1042-02","timestamp":"2026-06-16T13:50:00Z","assetId":"INV-042","severity":"medium","source":"SCADA","alertType":"efficiency_drop","message":"Conversion efficiency 95.2% below 96%","groupedIntoIncidentId":"INC-1042"},
  {"id":"ALT-1042-03","timestamp":"2026-06-16T14:10:00Z","assetId":"INV-042","severity":"high","source":"SCADA","alertType":"output_below_forecast","message":"Output 11% below weather-adjusted forecast","groupedIntoIncidentId":"INC-1042"},
  {"id":"ALT-1042-04","timestamp":"2026-06-16T14:20:00Z","assetId":"INV-042","severity":"high","source":"Inverter","alertType":"inverter_temperature_high","message":"Inverter temperature 87.4C exceeds 85C","groupedIntoIncidentId":"INC-1042"},
  {"id":"ALT-1042-05","timestamp":"2026-06-16T14:22:00Z","assetId":"INV-042","severity":"high","source":"Inverter","alertType":"cooling_fan_irregular","message":"Cooling fan 1080 rpm with temp 86.2C","groupedIntoIncidentId":"INC-1042"},
  {"id":"ALT-1042-06","timestamp":"2026-06-16T14:25:00Z","assetId":"INV-042","severity":"medium","source":"SCADA","alertType":"voltage_instability","message":"Voltage variance 2.4 above 2.0","groupedIntoIncidentId":"INC-1042"},
  {"id":"ALT-1042-07","timestamp":"2026-06-16T14:30:00Z","assetId":"INV-042","severity":"medium","source":"SCADA","alertType":"communication_timeout","message":"Telemetry gap after thermal warning","groupedIntoIncidentId":"INC-1042"}
]
```
(Compression viz shows 12 raw alerts → 1 incident; the array above lists the distinct types; duplicate fires bring the count to 12.)

### 10.5 Evidence (INC-1042)
```json
[
  {"id":"EV-1042-1","incidentId":"INC-1042","sourceType":"maintenance_history","title":"Similar cooling-fan issue 8 months ago","summary":"Work order WO-2025-00871: fan speed irregularity inspected, thermal sensor recalibrated. Note recommended fan replacement if temperature issue recurs.","relevanceScore":0.91,"timestamp":"2025-10-12T09:30:00Z"},
  {"id":"EV-1042-2","incidentId":"INC-1042","sourceType":"manufacturer_bulletin","title":"Fan degradation risk after 18,000 runtime hours","summary":"SunGrid SG-4000-XT bulletin MN-INV-001: elevated fan-bearing failure probability beyond 18,000h; inspect if temp exceeds 80C under nominal load.","relevanceScore":0.88},
  {"id":"EV-1042-3","incidentId":"INC-1042","sourceType":"weather_context","title":"Weather does not explain the loss","summary":"Irradiance stable (~910 W/m²), cloud cover 6%. Weather-adjusted forecast deviation 11% indicates equipment fault, not weather.","relevanceScore":0.84,"timestamp":"2026-06-16T14:30:00Z"},
  {"id":"EV-1042-4","incidentId":"INC-1042","sourceType":"asset_spec","title":"Runtime above fan-risk threshold","summary":"INV-042 runtime 19,450h exceeds 18,000h fan-risk threshold.","relevanceScore":0.79},
  {"id":"EV-1042-5","incidentId":"INC-1042","sourceType":"operating_procedure","title":"Cooling inspection SOP","summary":"Procedure SOP-INV-COOL-03: inspect fan and recalibrate thermal sensors within 24h of sustained >85C with efficiency loss.","relevanceScore":0.72}
]
```

### 10.6 Agent traces (INC-1042) — 8 nodes
```json
[
  {"id":"AT-1042-1","incidentId":"INC-1042","order":1,"agentName":"Alert Correlation Agent","role":"Group related alerts into one cluster","status":"complete","inputSummary":"12 raw alerts on INV-042","outputSummary":"1 cluster, max severity high","model":"gpt-4o-mini","latencyMs":820,"costUsd":0.004},
  {"id":"AT-1042-2","incidentId":"INC-1042","order":2,"agentName":"Telemetry Analysis Agent","role":"Detect trends and time-ordering","status":"complete","inputSummary":"6h telemetry window","outputSummary":"Thermal ramp; temp rose before output drop; fan unstable","model":"gpt-4o-mini","latencyMs":1640,"costUsd":0.006,"confidence":0.81},
  {"id":"AT-1042-3","incidentId":"INC-1042","order":3,"agentName":"Maintenance History Agent","role":"Find recurring/known failures","status":"complete","inputSummary":"INV-042 records + bulletins","outputSummary":"Similar fan issue 8 months ago; runtime > threshold","model":"gpt-4o-mini","latencyMs":1120,"costUsd":0.005},
  {"id":"AT-1042-4","incidentId":"INC-1042","order":4,"agentName":"Weather/Forecast Agent","role":"Separate weather from equipment fault","status":"complete","inputSummary":"Weather + forecast vs actual","outputSummary":"Weather does not explain loss; deviation 11%","model":"gpt-4o-mini","latencyMs":980,"costUsd":0.004},
  {"id":"AT-1042-5","incidentId":"INC-1042","order":5,"agentName":"Root Cause Agent","role":"Synthesize single root cause","status":"complete","inputSummary":"Outputs of agents 1-4","outputSummary":"Cooling subsystem degradation (conf 0.83)","model":"gpt-4o-mini","latencyMs":1530,"costUsd":0.007,"confidence":0.83},
  {"id":"AT-1042-6","incidentId":"INC-1042","order":6,"agentName":"Business Impact Agent","role":"Quantify impact","status":"complete","inputSummary":"Forecast vs actual, $75/MWh","outputSummary":"2.8 MWh/day, $210/day","model":"gpt-4o-mini","latencyMs":640,"costUsd":0.003},
  {"id":"AT-1042-7","incidentId":"INC-1042","order":7,"agentName":"Safety/Governance Agent","role":"Apply governance rules","status":"warning","inputSummary":"Incident draft","outputSummary":"Approval required; escalation: site engineer","model":"gpt-4o-mini","latencyMs":510,"costUsd":0.002},
  {"id":"AT-1042-8","incidentId":"INC-1042","order":8,"agentName":"Operator Briefing Agent","role":"Write operator summary","status":"complete","inputSummary":"Full incident","outputSummary":"Concise briefing generated","model":"gpt-4o","latencyMs":2100,"costUsd":0.011,"confidence":0.82}
]
```

### 10.7 TrueFoundry traces (INC-1042 sample)
```json
[
  {"id":"TF-1042-1","incidentId":"INC-1042","caller":"Alert Correlation Agent","service":"ai-gateway","model":"gpt-4o-mini","routedModel":"gpt-4o-mini","provider":"OpenAI","endpoint":"/api/llm/chat/completions","latencyMs":820,"costUsd":0.004,"status":"success","timestamp":"2026-06-16T14:40:01Z"},
  {"id":"TF-1042-5","incidentId":"INC-1042","caller":"Root Cause Agent","service":"ai-gateway","model":"gpt-4o-mini","routedModel":"gpt-4o-mini","provider":"OpenAI","endpoint":"/api/llm/chat/completions","latencyMs":1530,"costUsd":0.007,"status":"success","timestamp":"2026-06-16T14:40:06Z"},
  {"id":"TF-1042-8","incidentId":"INC-1042","caller":"Operator Briefing Agent","service":"ai-gateway","model":"gpt-4o","routedModel":"gpt-4o","provider":"OpenAI","endpoint":"/api/llm/chat/completions","latencyMs":2100,"costUsd":0.011,"status":"success","timestamp":"2026-06-16T14:40:10Z"},
  {"id":"TF-1042-A","incidentId":"INC-1042","caller":"Anomaly Scoring","service":"renewable-anomaly-service","model":"rule-based","routedModel":"rule-based","provider":"TrueFoundry","endpoint":"/score","latencyMs":180,"costUsd":0.0,"status":"success","timestamp":"2026-06-16T14:39:58Z"}
]
```
Observability summary fixture: `{ totalCalls: 18, totalLatencyS: 11.4, estCostUsd: 0.042, failed: 0, fallbacks: 0, service: "renewable-anomaly-service", p95Ms: 220, health: "Healthy" }`.

### 10.8 Governance rules
```json
[
  {"id":"GR-1","name":"Critical safety risk","condition":"safety_risk == critical","triggered":true,"action":"Require human approval","severity":"critical"},
  {"id":"GR-2","name":"Asset offline action","condition":"action involves taking asset offline","triggered":true,"action":"Require human approval","severity":"high"},
  {"id":"GR-3","name":"Low confidence","condition":"confidence < 0.70","triggered":false,"action":"Escalate to engineer","severity":"medium"},
  {"id":"GR-4","name":"BESS thermal risk","condition":"bess_thermal_risk detected","triggered":false,"action":"Critical escalation required","severity":"critical"}
]
```
(For Scenario C, GR-4 `triggered: true`.)

### 10.9 Evaluation cases
```json
[
  {"scenario":"Normal Operation","expectedRootCause":"normal_operation","predictedRootCause":"normal_operation","expectedPriority":"low","predictedPriority":"low","expectedAction":"continue_monitoring","predictedAction":"continue_monitoring","result":"pass"},
  {"scenario":"Inverter Cooling Degradation","expectedRootCause":"cooling_subsystem_degradation","predictedRootCause":"cooling_subsystem_degradation","expectedPriority":"high","predictedPriority":"high","expectedAction":"inspect_cooling_fan_within_24_hours","predictedAction":"inspect_cooling_fan_within_24_hours","result":"pass"},
  {"scenario":"BESS Thermal Risk","expectedRootCause":"bess_thermal_management_degradation","predictedRootCause":"bess_thermal_management_degradation","expectedPriority":"critical","predictedPriority":"critical","expectedAction":"escalate_to_site_engineer_and_inspect_cooling_loop_immediately","predictedAction":"escalate_to_site_engineer_and_inspect_cooling_loop_immediately","result":"pass"}
]
```

### 10.10 Telemetry series (shape example, INC-1042 temperature)
```json
{
  "id":"TS-1042-temp","incidentId":"INC-1042","metric":"inverter_temperature_c",
  "title":"Inverter Temperature","unit":"°C","threshold":85,
  "series":[
    {"timestamp":"2026-06-16T13:00:00Z","value":61.2},
    {"timestamp":"2026-06-16T13:30:00Z","value":71.5},
    {"timestamp":"2026-06-16T14:00:00Z","value":80.3},
    {"timestamp":"2026-06-16T14:20:00Z","value":87.4},
    {"timestamp":"2026-06-16T14:35:00Z","value":90.1}
  ]
}
```
Generate ~36 points (6h @ 10-min) per series in fixtures using a small helper; the abbreviated set above shows the upward ramp crossing the 85 threshold.

---

## 11. Interaction Behavior

1. **Scenario selector** (`ScenarioProvider`): selecting a scenario swaps the active `ScenarioBundle` in context; every screen re-derives from context — KPIs, queue, brief, charts, traces, governance, evaluation all update instantly with no route change/reload.
2. **Run AI Analysis** button: sets AI status pill → `Analyzing…` (amber), disables button, shows a progress strip/overlay.
3. **Staged agent run:** iterate `agentTraces` in `order`, marking each `pending → running → complete` with ~600–1200ms between steps (configurable `STEP_MS`). Command Center status strip and AI Workflow nodes animate in sync. On finish: status → `GridOps AI Online`, toast "Analysis complete — 1 incident generated", and the incident appears/refreshes in the queue. Respect `prefers-reduced-motion` (skip to final state).
4. **Click incident row:** single click selects (populates brief); "Open Incident"/double-click → `/incidents/:id`.
5. **View AI Workflow:** navigates to `/ai-workflow?incident=:id`.
6. **View TrueFoundry Trace:** navigates to `/observability?incident=:id`.
7. **Approve Inspection:** sets incident `status → approved`, approval badge → "Approved by {operator}", appends `approved` audit event, toast "Inspection approved".
8. **Create Work Order:** toast "Work order WO-2026-04412 created", status → `work_order_created`, append `workorder_created` audit event, disable button.
9. **Mark as False Positive:** opens feedback modal (reason textarea + confirm). On confirm: status → `closed`, append `acknowledged` audit event, toast "Marked as false positive".
10. **Evaluation page:** renders pass/fail per scenario; "Re-run" simulates progress then shows deterministic passes.

**Loading state:** skeleton shimmer for KPI cards, table rows, and charts (light gray blocks). Buttons show inline `Loader2` spinner when busy.

**Empty state:** Scenario A queue with no high/critical incidents shows a calm panel: green `CheckCircle2`, "All systems nominal — continue monitoring", with the single low incident below.

**Error state:** if live API mode fails, show non-blocking banner "Live API unavailable — showing demo data" and fall back to fixtures automatically. Per-widget error → small inline retry.

---

## 12. Hackathon Demo Flow (3 minutes, judge-facing)

1. **(0:00) Alert overload problem** — Open Command Center on Scenario B; point to "Alerts Correlated 12 → 1" and the alert compression viz: "Operators drown in disconnected alerts."
2. **(0:20) Scenario selection** — Switch to Normal to show calm baseline, then back to Inverter Cooling Degradation: "Same console, different situation, instant."
3. **(0:35) Alert compression** — Watch 12 raw alert chips converge into one incident card (`12:1`).
4. **(0:50) Root-cause diagnosis** — Open INC-1042; read the root-cause narrative + 82% confidence.
5. **(1:10) Supporting evidence** — Scroll evidence cards: 8-month-ago maintenance, manufacturer 18,000h bulletin, weather rules out weather, runtime threshold. Show telemetry: temperature rises *before* output drops.
6. **(1:35) Business impact** — Point to 2.8 MWh/day · $210/day: "Prioritized by money at risk."
7. **(1:50) Human approval / governance** — Show governance banner + Approve Inspection; open Governance page: restricted vs allowed actions, audit trail. "AI is decision support, not grid control."
8. **(2:15) CrewAI workflow trace** — Open AI Workflow: 8 agents, inputs/outputs, models, latency, cost, confidence: "Multi-agent reasoning, fully inspectable."
9. **(2:35) TrueFoundry observability** — Open Observability: 18 calls, $0.042, p95 220ms, anomaly service Healthy, 0 failures/fallbacks, routing table: "Production AI infra."
10. **(2:50) Evaluation results** — Open Evaluation: 3/3 root cause, 100% priority, 0% false escalation: "Reliable and measured." Close on Scenario C critical to show severity scaling.

---

## 13. Implementation Notes for Building Agent

- **Stack:** Next.js 14 (App Router) + TypeScript + Tailwind CSS. Lucide icons. Recharts for charts.
- **Data first:** implement everything against static JSON/TS fixtures in `/data`. No backend required for MVP.
- **API layer:** `/lib/api.ts` exposes async functions (`getScenario`, `getIncident`, `runAnalysis`, `approveInspection`, etc.) that resolve from fixtures with `await delay(ms)` to simulate latency. Behind `NEXT_PUBLIC_USE_LIVE_API`, the same functions call the real backend (incident_api `:8000`, crew `:8003`, anomaly `:8001`) — but live mode is optional and must degrade gracefully to fixtures.
- **State:** `ScenarioProvider` (React Context) holds active scenario + mutable incident statuses + audit events; all screens read from it.
- **Polish:** hover/focus states, soft shadows, smooth scenario switching, sequential agent animation, toasts, modals, skeletons. Demo reliability > real integration.
- **Safety:** every operational action is simulated (status change + toast + audit). No real control logic. Never call anything that could imply real asset control.
- **Make CrewAI + TrueFoundry visible:** the AI Workflow and Observability screens are first-class and must render rich, believable data.
- **Scenario switch must be instant and reliable** — purely client-side context swap.
- **Folder structure (suggested):**
```text
app/(app)/command-center/page.tsx
app/(app)/incidents/page.tsx
app/(app)/incidents/[id]/page.tsx
app/(app)/ai-workflow/page.tsx
app/(app)/observability/page.tsx
app/(app)/governance/page.tsx
app/(app)/evaluation/page.tsx
app/(app)/layout.tsx            # shell: sidebar + header
components/                     # StatusBadge, MetricCard, IncidentCard, AgentTraceNode, EvidenceCard, TelemetryChart, ActionPanel, ...
lib/api.ts  lib/format.ts  lib/severity.ts
providers/ScenarioProvider.tsx
data/scenarios.ts  data/telemetry.ts
types/index.ts
tailwind.config.ts
```

---

## 14. Accessibility

- **Never color-only:** every severity badge pairs color with an icon and a text label.
- **Labels + icons:** `StatusBadge`/status pills include `aria-label` with severity word (e.g., "Severity: high").
- **Contrast:** all text meets WCAG AA on light surfaces (text.main/secondary on bg.surface/base verified). Avoid muted text on tinted severity backgrounds below AA.
- **Keyboard:** all interactive controls (nav, scenario selector, buttons, table rows, drawer/modal close) are focusable with visible focus rings (`ring-2 ring-brand-primary ring-offset-2`); modals trap focus and close on Esc.
- **Semantic structure:** one `<h1>` per page, ordered headings, `<nav>`, `<main>`, `<table>` with `<th scope>`, buttons are real `<button>`s, links are `<a>`/`Link`.
- **Charts summarized in text:** each `TelemetryChart` renders a one-line text summary (e.g., "Inverter temperature rose from 61°C to 90°C over 95 minutes, crossing the 85°C threshold at 14:20") and a visually-hidden data summary for screen readers.
- **Motion:** honor `prefers-reduced-motion` — agent sequence and compression animation jump to final state.
- **Live regions:** AI status pill and toasts use `aria-live="polite"`.

---

## 15. Final Delivery Checklist

- [ ] Command Center implemented (KPIs, priority queue, selected brief, alert compression, AI status)
- [ ] Incident Detail implemented (hero, narrative, telemetry charts, evidence timeline + cards, business impact, sticky action panel, governance warning)
- [ ] AI Workflow screen implemented (agent pipeline, per-node details, totals)
- [ ] Observability screen implemented (gateway summary, routing table, service health, trace timeline, cost/latency, fallbacks, audit logs)
- [ ] Governance screen implemented (rules, pending approvals, audit trail, allowed vs restricted)
- [ ] Evaluation screen implemented (summary metrics + per-scenario results)
- [ ] Scenario selector works (instant, client-side, swaps all data)
- [ ] Hero incident data renders (INC-1042, INC-2091, normal case)
- [ ] Charts render (Recharts, thresholds, comparison series)
- [ ] Agent traces render (status, model, latency, cost, confidence)
- [ ] TrueFoundry metrics render (calls, cost, latency, p95, health, fallbacks)
- [ ] Human approval simulation works (status change + audit + toast)
- [ ] Create work order / escalate / false positive simulations work
- [ ] Loading, empty, and error states implemented
- [ ] Accessibility: icon+label severity, keyboard nav, chart text summaries
- [ ] Demo path works without external dependencies (fixtures only)
