# Fabio Edge Research Lab Project State

Last updated: 2026-06-07

## Product Identity

Fabio Edge Research Lab is a local-first, research-first decision-support
platform for discretionary trading and long-term investment research.

The codebase and older documents may contain the legacy name "Liam Trading
Brain." Fabio Edge Research Lab is the canonical product name.

The platform measures evidence, exposes assumptions, and supports human
decisions. It does not connect to brokers, place orders, trade automatically,
sell signals, or guarantee outcomes.

See [PROJECT_GOAL.md](PROJECT_GOAL.md) for the product charter and
[DATA_POLICY.md](DATA_POLICY.md) for data eligibility and audit rules.

## Current Modules

### Trading Research

- Dashboard with trade performance, data quality, skipped/taken counts, POC
  comparisons, mistake analysis, strategy versions, sessions, and research
  summaries.
- Trade Logger with fast entry, templates, draft autosave, duplicate-last-trade,
  screenshots, CSV import/export, auto RR/result R, auto setup score, manual
  quality, and localStorage fallback.
- Broker Trade Import for CSV-only historical imports.
- Review Imported Trades queue for completing imported records.
- Setup Analyzer with rule-based score, similar trades, historical
  probabilities, POC warnings, confidence, management-rule output, and export.
- Edge Lab for expectancy, R distributions, profit factor, break-even rate,
  drawdown, Monte Carlo, and setup breakdowns.
- Management Lab for historical TP1 management-rule comparisons.
- Risk / Monte Carlo tools using eligible taken trades.
- Screenshot Library and Research Lab for review, mistakes, daily scores,
  market context, news, sessions, strategy versions, and edge discovery.
- Pre-market and post-trade checklist.

### Investment Research

- Investment Lab with local stock universes and local-first state.
- FMP free-plan compatible endpoint detection, quota reconciliation, cache
  classification, custom scan priorities, previews, and Scan ROI.
- SEC EDGAR XBRL fallback for operating cash flow, CapEx, latest FCF, and
  normalized three- and five-year FCF.
- Hybrid make-valid workflow combining cache, FMP, SEC, and manual inputs.
- Data-source audit, mapping audit, raw response inspector, and reliability
  reporting.
- DCF, normalized FCF DCF, primary DCF mode selection, reverse DCF, sensitivity
  analysis, Bear/Base/Bull valuation, probability-weighted fair value, and
  scenario decision labels.
- Research-only portfolio and diversification tooling.

### Other Modules

- Freedom Dashboard for personal goals and trading-result progress.
- Multi-language UI with English, Chinese, and Japanese support in the current
  custom i18n architecture.
- Market Lab under Experimental for market-data import and detector validation.
  It is not the primary product direction.

## Stable Trading Features

### Tradovate Closed Trades CSV

- Detects Tradovate columns including symbol, quantity, buy/sell price, PnL,
  bought/sold timestamps, and duration.
- Preserves the original broker symbol while normalizing contracts such as
  `MNQM6` to `MNQ`.
- Infers direction from transaction order:
  - Buy before sell is Long.
  - Sell before buy is Short.
- Uses PnL formulas as a consistency check and exposes mismatches.
- Parses currency-formatted positive and negative PnL.
- Maps positive, zero, and negative outcomes without converting broker trades
  into `NoTrade`.
- Uses a deterministic duplicate identifier when a broker trade ID is absent.
- Keeps `result_r` null until stop loss and the other required inputs exist.

### Imported Trade Review

- Imported records are marked imported, unreviewed, taken, and incomplete.
- The completeness summary counts imported review status, missing research
  fields, calculated R values, and R completion rate.
- The review queue shows only imported unreviewed records and prioritizes
  missing stop loss, setup type, session, and manual quality before absolute
  PnL and recency.
- Quick-edit fields include setup type, session, regime, manual quality, stop
  loss, location, and notes.
- Batch apply supports session, setup type, regime, manual quality, location,
  and an explicitly entered stop loss.
- Each trade shows a completeness badge, missing-fields checklist, and Edge Lab
  eligibility.
- Save & Next marks a trade reviewed only after the Edge Lab eligibility fields
  are complete.
- Skip With Reason stores a review note, leaves the trade unreviewed, and
  advances the queue.
- Result R is recalculated only after a valid stop loss is supplied.
- Edge Lab eligibility for imported records requires Taken, a valid `result_r`,
  `setup_type`, `session`, and `manual_quality`.

### Trading Data Rules

- Core analytics and Monte Carlo use only eligible good taken trades.
- `setup_score` is system-calculated.
- `manual_quality` is trader judgement and does not replace statistical scoring.
- Incomplete imports remain stored but are excluded where required.
- Legacy database values remain supported for backward compatibility.

## Stable Investment Features

- Local S&P 500, Nasdaq 100, and Dow 30 universes do not depend on a premium
  screener endpoint.
- The FMP `cashFlow` endpoint is remembered as premium blocked for the current
  plan and must not be requested repeatedly.
- Available FMP endpoints, cache data, SEC EDGAR, and manual values can be
  combined without hiding their source.
- Empty, failed, stale, valid, and premium-blocked FMP cache states are distinct.
- SEC EDGAR requests use ticker-to-CIK mapping, annual company facts, cache, a
  declared User-Agent, and conservative pacing.
- FCF data records the concepts and annual periods used.
- Scenario decisions show separate Bear/Base/Bull values, weighted fair value,
  upside/downside, risk/reward, and missing-data reasons.
- Scan ROI records calls, endpoint outcomes, data gained, and newly valid stocks.
- Diagnostic panels expose raw and mapped data without changing scoring logic.
- Scanner Diagnostics summarizes local universe state, FMP key presence, safe
  quota, endpoint health, bad cache counts, preview status, and likely scan
  blockers before spending calls.
- Data Coverage Verification explains why individual stocks are below 100%
  real data, highlights missing/fallback components, and separates automatic
  repair paths from manual or blocked-data cases.
- Re-audit All Stocks reapplies local FMP, SEC EDGAR, and manual cache to
  stored stock records without making API calls.
- `start-investment-lab.bat` starts the backend and frontend together, opens
  Investment Lab, and can trigger the free/local Stage 1 scan through
  `/investment-lab?autoscan=local`.
- Local Data Backup in Investment Lab diagnostics exports and restores known
  browser localStorage keys for trades, Investment Lab cache/settings, Market
  Lab validation data, freedom goals, checklist state, and preferences.

Counts of cached or scenario-valid stocks are browser-profile and date
dependent. They are runtime observations, not a stable repository capability.

## Architecture

- Frontend: Next.js, React, TypeScript, Tailwind CSS, and localStorage fallback.
- Backend: FastAPI, SQLAlchemy, and PostgreSQL schema/migrations.
- Analytics: Python services with Pandas/NumPy-compatible boundaries.
- ML: architecture placeholders only; no active training.
- Deployment and validation: local scripts and Docker-compatible configuration.

## Known Limitations

- LocalStorage, API quota state, SEC cache, watchlists, and portfolio data are
  not shared automatically between browsers or collaborators.
- Local Data Backup is a manual JSON export/import workflow. It is not cloud
  sync and backup files may contain locally saved FMP keys or user research
  data, so they must be stored privately.
- FMP coverage depends on subscription capabilities, quota, and endpoint
  availability.
- SEC XBRL concepts can be missing or ambiguous for some issuers.
- Traditional FCF DCF is often unsuitable for banks, insurers, and some other
  financial firms.
- Valuation results remain sensitive to growth, discount-rate, terminal-growth,
  and share-count assumptions.
- Historical trading conclusions can be unreliable when samples are small or
  review fields are incomplete.
- Market Lab detector logic is experimental and duplicated across frontend and
  backend paths; it must not be changed without an explicit request.
- i18n is a custom lightweight implementation rather than route-based Next.js
  localization.
- Cloud synchronization is reserved architecture only.

## Development Boundaries

- Do not add live broker connections, order placement, or automatic trading.
- Do not add ML training without an explicit request and clean-data gate.
- Do not change scoring weights or DCF assumptions unless explicitly requested.
- Do not touch Market Lab unless explicitly requested.
- Do not silently alter data eligibility or recommendation confidence rules.
- Do not commit secrets, API caches, broker exports, or user data.

## Required Validation

Run from the project root before reporting success:

```powershell
cd frontend
npm.cmd run build
npm.cmd run lint
cd ..
backend\.venv\Scripts\python.exe -m pytest
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\check-secrets.ps1
git diff --check
```

## Next Recommended Milestones

1. Trading data integrity and imported-trade completion.
2. Consistent trading edge evidence with sample-size and eligibility context.
3. Investment data coverage and valuation-model validation.
