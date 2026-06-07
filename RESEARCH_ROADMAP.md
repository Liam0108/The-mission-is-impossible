# Research Roadmap

Last updated: 2026-06-07

This roadmap prioritizes reliable evidence over feature volume. A later phase
must not start merely because an earlier feature exists; its data-quality and
validation gates must also be satisfied.

## Milestone 1: Trading Data Integrity

Goal: make completed trade history reliable enough for research.

Priorities:

- Expand broker CSV parser regression fixtures without adding live connections.
- Measure completion rates for stop loss, result R, setup type, session, regime,
  manual quality, mistakes, and notes.
- Make the imported-trade review queue the primary path from raw fills to
  research-ready trades.
- Audit duplicate handling, symbol normalization, direction inference, PnL
  validation, and timestamp parsing.
- Keep R blank when stop loss or another required input is missing.

Exit criteria:

- Import logic is covered by representative fixtures.
- Required-field and data-quality counts are reproducible.
- Good, incomplete, and bad records are clearly separated.
- Analytics exclude ineligible records without deleting them.

## Milestone 2: Trading Edge Evidence

Goal: determine where a strategy has measurable positive or negative edge.

Priorities:

- Consolidate expectancy, average R, profit factor, drawdown, and Monte Carlo
  reporting around eligible taken trades.
- Compare setup performance by symbol, session, direction, regime, setup type,
  and manual quality.
- Add visible sample-size and data-completeness context to every conclusion.
- Connect mistake and execution review to financial impact.
- Compare management rules without changing the original trade record.

Exit criteria:

- Every metric identifies its eligible sample and exclusions.
- Small samples are labelled as preliminary rather than conclusive.
- Segment comparisons use the same definitions across Dashboard, Edge Lab,
  Risk, and Management Lab.
- Exported research can be reproduced from stored trade records.

## Milestone 3: Investment Data and Valuation Validation

Goal: increase trustworthy valuation coverage without hiding missing data or
wasting free-plan quota.

Priorities:

- Improve FMP and SEC field-coverage audits and cache diagnostics.
- Verify price, share count, FCF, historical data, ratios, and income-statement
  mappings against raw payloads.
- Track which source and transformation populated every scored field.
- Reconcile DCF, normalized FCF, reverse DCF, and scenario outputs.
- Mark sectors where standard FCF DCF is unsuitable or requires a different
  research model.

Exit criteria:

- Scenario-valid status has a documented, testable definition.
- Reliability percentages are based on traceable source data.
- Missing or blocked endpoints cannot masquerade as fresh valid data.
- Valuation disagreements and weak assumptions are visible before rankings.

## Milestone 4: Portfolio Research

Goal: study allocation and concentration after candidate data and valuation are
reliable.

Potential work:

- Research-only allocation plans with explicit constraints.
- Sector, single-stock, high-risk, speculative, and cash exposure analysis.
- Scenario-weighted portfolio risk and drawdown sensitivity.
- Saved assumptions and reproducible plan comparisons.
- Kelly-style sizing as a labelled research experiment, never as an order
  instruction.

Gate:

- Candidate inputs must meet the Investment Lab reliability policy.
- Allocation outputs must retain research-only warnings and show exclusions.

## Milestone 5: Advanced Mathematical Research

Potential models:

- Volatility and drawdown regime analysis.
- GARCH volatility models.
- Hawkes-process event clustering.
- Kyle-style market-impact research.
- Almgren-Chriss execution-cost research.
- Order-flow imbalance models.

Required before implementation:

- A named research question and target output.
- A documented input dataset with sufficient coverage.
- Source and transformation auditability.
- Baseline comparison and validation method.
- Failure-mode and uncertainty explanation.
- Tests proving that missing data cannot create confident output.

These models are not part of the current implementation plan.

## Experimental Market Lab

Market Lab remains an experimental area. It is not the main product direction
and must not be changed unless the user explicitly requests Market Lab work.
Its detector outputs must not be treated as trading signals or execution logic.

## Explicitly Out of Scope

- Live broker connections.
- Order placement and execution.
- Automatic trading.
- Signal selling.
- Guaranteed-return claims.
- ML training without a separate request and clean-data gate.
- Complex models added only for appearance or novelty.

## Current Recommended Sequence

1. Trading data integrity and imported-trade completion.
2. Trading edge evidence with consistent eligibility and sample-size rules.
3. Investment data coverage and valuation validation.
