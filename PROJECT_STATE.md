# Liam Trading Brain Project State

Last updated: 2026-06-05

## Product Purpose

Liam Trading Brain, also known in the codebase as Fabio Edge Research Lab, is a local-first discretionary trading research and decision-support platform plus a research-only Investment Lab.

It is not an automated trading system. It does not connect to brokers, place orders, execute trades, or use API keys for live execution. The trader manually labels setups; the software handles logging, statistics, scoring, similarity search, risk research, and market-data detector validation.

## Current Major Capabilities

- Dashboard with trade performance, data quality, skipped/taken counts, POC comparison, mistakes, strategy versions, sessions, and research analytics.
- Trade Logger with fast setup entry, duplicate-last-trade, templates, screenshot upload, CSV import/export, draft autosave, localStorage fallback, auto RR/result R, auto setup score, optional manual quality, and Chinese UI support.
- Setup Analyzer with rule-based setup score, similar trade search, TP1/BE/SL probabilities, POC warning, confidence, best management rule, and export support.
- Management Lab with TP1 management rule comparisons and regime grouping.
- Risk / Monte Carlo page using valid taken trades only.
- Screenshot Library with searchable screenshot research assets and validation metadata.
- Research Lab with review analytics, daily scores, market context, news filter, session refinement, strategy version comparison, and edge discovery.
- Checklist page for pre-market and post-trade process review.
- Freedom Dashboard for personal goal tracking connected to trading PnL calculations.
- Market Lab for importing 1m/5m candle CSV data, including TradingView exports with extra columns, detecting swings, liquidity sweeps, FVGs, setup candidates, and collecting manual validation feedback.
- Structure Importance calibration view in Market Lab for comparing top/bottom importance swings, filtering by session and HH/HL/LH/LL, validating each swing, and exporting calibration feedback CSV.
- Investment Lab with local stock universes, FMP free-plan compatible enrichment, scientific scoring, normalized DCF, reverse DCF, Bear/Base/Bull scenarios, probability-weighted scenario decisions, portfolio rules, and bilingual UI.
- Investment data coverage management with quota reconciliation, custom scan priorities, scan previews, scan ROI tracking, and hybrid completion diagnostics.
- SEC EDGAR XBRL fallback for annual operating cash flow, CapEx, latest FCF, 3-year average FCF, and 5-year average FCF.

## Current Stable Investment Lab State

- The investment data pipeline combines local S&P 500, Nasdaq 100, and Dow 30 universes with cached/manual data, compatible FMP endpoints, and SEC EDGAR company facts.
- FMP `cashFlow` is permanently treated as premium blocked for the current plan. Make Valid scans must not request it.
- SEC EDGAR is the FCF fallback and uses ticker-to-CIK mapping, annual 10-K facts, local cache, a declared User-Agent, and conservative request pacing.
- Scenario Decision Engine calculates Bear/Base/Bull values, probability-weighted fair value, upside/downside, risk/reward, and scenario decision labels.
- Scan ROI records batch mode, estimated and actual calls, endpoint outcomes, new valid stocks, and calls per valid stock.
- Custom priority controls include market cap, data coverage, watchlist, sector preference, missing-field count, quality, valuation, risk, and manual ticker order.
- Hybrid Make Valid completion prioritizes stocks that already have SEC FCF and need only available FMP profile, historical, income, or ratios data.
- Current local coverage snapshot: 9 stocks have SEC FCF and 6 stocks have valid scenario data. Local browser data can differ by profile and date.

## Recent Changes

- Swing Detector V2 added configurable mode, left/right candle count, minimum swing distance, swing score, accepted-swing reasoning, and V1/V2 count comparison.
- Structure Importance Engine V1 added a 0-100 score for V2 swings using displacement, BOS potential, CHOCH potential, liquidity interaction, session significance, and volume expansion.
- Trade Logger field clarity upgrade:
  - Sweep Yes/No is now displayed as Sweep Timeframe: None, 1m, 5m, 15m, PDH/PDL, Session High/Low.
  - CHOCH Yes/No is now displayed as CHOCH Timeframe: None, 1m, 5m, 15m.
  - LH/HL is now Entry Pullback Structure: None, HL for Long, LH for Short, Failed HL, Failed LH.
  - POC Risk is now POC Chop Risk: Low, Medium, High.
  - Setup Score is read-only and recalculated automatically on save.
  - Manual Quality added: A+, A, B, C, Skip.
  - Trade Logger visible labels, helper text, buttons, placeholders, and options support Chinese display.

## Data Rules

- Analytics, Monte Carlo, and future ML should use only valid taken trades with `data_quality = good`.
- `setup_score` is system-calculated. Do not treat it as a manual input.
- `manual_quality` is optional trader judgment and must not override statistical scoring.
- New structure fields still use existing database columns for compatibility:
  - `liquidity_sweep` stores sweep timeframe/level.
  - `choch` stores CHOCH timeframe.
  - `lh_hl` stores entry pullback structure.
- Backend constraints preserve legacy Yes/No values so older records do not break.

## Local Development Status

- Frontend: Next.js, React, TypeScript, Tailwind, localStorage fallback.
- Backend: FastAPI, SQLAlchemy, PostgreSQL schema/migrations.
- Market data analysis exists in both frontend local fallback and backend service.
- Python 3.12 is the intended backend runtime, but tests have also been run with Python 3.11 using project requirements.

## Validation Commands

Frontend:

```powershell
cd frontend
npm.cmd run build
npm.cmd run lint
```

Backend:

```powershell
cd backend
python -m pytest tests
```

If local Python lacks dependencies, install `backend/requirements.txt` in a virtual environment first.

## Hard Product Boundaries

- Do not add broker execution.
- Do not add live order placement.
- Do not add automatic trading.
- Do not add API-key based broker integrations.
- Do not add ML training until the valid taken trade threshold is met.
- Do not rely on screenshots for future market-data detection logic.

## Known Implementation Notes

- The app name is still mixed between Fabio Edge Research Lab and Liam Trading Brain. Code paths mostly use Fabio naming.
- i18n is lightweight and custom in `frontend/lib/i18n.ts`; it is not using Next.js route-based localization.
- Local fallback behavior is in `frontend/lib/local-store.ts`.
- Market Lab detector logic is duplicated in frontend and backend; keep algorithms aligned when changing detector rules.
- Investment Lab data and API quota state are stored locally in the browser and are not shared automatically between collaborators.
- FMP cache/API coverage depends on the user's subscription and daily quota. Empty fresh cache entries can temporarily prevent a useful re-fetch.
- Traditional FCF DCF may not suit banks, insurers, or other financial firms; those records show a sector exception warning.
- SEC XBRL concepts can be absent or ambiguous for some issuers and require audit before trusting the result.
- FMP credentials currently entered through the Investment Lab UI are local browser settings. Never commit or share browser storage exports containing them.
- The Git repository uses `main`, feature branches, pull requests, a local pre-commit secret check, and ignored runtime API caches.

## Development Boundary

Do not modify Market Lab unless the user explicitly requests a Market Lab change. Investment Lab work must not silently alter market detector logic.
