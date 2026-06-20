# Fabio Edge Research Lab

Professional trading research and decision-support platform for discretionary NQ/MNQ traders.

This software is not an automated trading system. It never places orders and does not predict market direction. It helps a trader measure trade quality, compare setups against history, and improve execution through statistics.

## MVP Scope

- Dashboard
- Trade Logger
- Setup Analyzer
- Statistics Engine
- Probability Engine
- Trade Improvement Lab
- Screenshot Library
- Research Lab

Future modules such as TradingView integration, broker integration, screenshot analysis, voice notes, order-flow automation, and machine learning are intentionally excluded from the MVP implementation.

## Architecture

```text
fabio-edge-research-lab/
  backend/
    app/
      api/routes/        FastAPI route modules
      core/              Settings and shared config
      db/                SQLAlchemy session and PostgreSQL schema
      db/migrations/     Safe additive database migrations
      ml/                ML-ready architecture, disabled by default
      models/            Database models
      schemas/           Pydantic request/response models
      services/          Scoring, probability, analytics, CSV logic
    tests/               Engine unit tests
  frontend/
    app/                 Next.js App Router pages
    components/          App shell, charts, forms, UI primitives
    lib/                 API client, constants, utilities
  PROJECT_GOAL.md        Product mission and permanent boundaries
  PROJECT_STATE.md       Current stable modules and limitations
  RESEARCH_ROADMAP.md    Data-gated research milestones
  DATA_POLICY.md         Data source, quality, and audit rules
```

## Stack

- Frontend: Next.js, React, TypeScript, Tailwind CSS, shadcn-inspired UI primitives
- Backend: Python, FastAPI
- Database: PostgreSQL
- Analytics: Pandas-ready service boundary, NumPy-compatible calculations
- Machine Learning: architecture placeholder only; disabled until at least 300 trades
- Charts: TradingView Lightweight Charts for the performance curve; compact Tailwind visualizations elsewhere
- Deployment: Docker Compose

## Upgrade Features

- Ultra-fast trade entry with remembered defaults, draft autosave, duplicate last trade, drag-and-drop screenshots, and automatic RR/result R calculations
- No Trade records with `trade_decision` and `skip_reason`
- Weighted similar setup search in Setup Analyzer
- POC risk filter with historical near-POC SL rate
- TP1 management rule comparison in Management Lab
- ML-ready architecture only; no training until at least 300 valid taken trades
- `user_id` and `workspace_id` fields for future cloud sync
- English, Chinese, and Japanese UI language selector

## Phase 3 Features

- Screenshot Library with grid, timeline, and list views
- Screenshot search by session, direction, location, result, score, date range, strategy version, market state, CHOCH, sweep, FVG strength, trade decision, and tag
- Screenshot favorites, bookmarks, notes, lessons learned, and trade-record links
- Review System for followed plan, mistake type, discipline score, execution score, emotion score, and review notes
- Daily Trading Score for discipline, execution, risk control, consistency, emotional control, and overall score
- Market Context fields for daily, weekly, and monthly bias
- News Filter fields for high-impact news, news type, and timing
- Detailed session refinement for NY Open, NY Power Hour, NY Lunch, NY PM, Asian Early/Late, London Open/Mid
- Strategy Version Control via `strategy_version`
- Edge Discovery Engine for best/worst conditions, TP1/SL-heavy conditions, highest RR, and consistency

## Risk Research Upgrade

- Data Quality Layer classifies records as `good`, `incomplete`, or `bad`
- Analytics, Monte Carlo, Management Lab, Research Lab, and future ML use only good taken trades
- Dashboard shows Data Quality counts and missing-field warnings
- Monte Carlo Risk page simulates 1,000 to 10,000 equity curves from historical Result R
- Account presets: 25k, 50k, 100k, 150k
- Risk can be entered as dollars or percent
- Management Lab now includes regime grouping by market state, session, location, POC risk, news timing, and strategy version

## Math Edge Lab V2

- `setup_type` is available on trade records, local storage, CSV import/export, and Trade Logger
- Edge Lab groups valid taken trades by setup type
- Setup edge metrics include trade count, win rate, average win/loss R, EV, profit factor, average R, max drawdown, best R, and worst R
- Break-even analysis compares average reward:risk, required break-even win rate, actual win rate, and edge difference
- Monte Carlo V2 shows median simulated return, worst 5% outcome, best 5% outcome, simulated max drawdown, and chance of ending negative
- Risk labels are research-only: `Skip`, `0.25R`, `0.5R`, and `1R`

## Broker Trade Import V1

Broker Import is a CSV-only workflow. It does not connect to brokers, place orders, or automate trading.

Supported first-pass sources:

- Tradovate CSV
- NinjaTrader CSV
- Generic broker/platform CSV

The importer looks for these columns and ignores unknown columns:

```csv
account,symbol,direction,quantity,entry_time,exit_time,entry_price,exit_price,gross_pnl,commission,net_pnl,trade_id,stop_loss
SIM101,NQM6,Long,1,2026-06-03T09:35:00,2026-06-03T09:50:00,19000.00,19025.00,500.00,4.50,495.50,TV-123,18975.00
```

Aliases such as `instrument`, `qty`, `side`, `entry price`, `exit price`, `gross p/l`, `net p/l`, and `order id` are also detected. Imported trades are marked with `imported = true` and `review_status = unreviewed`, then appear in the Trade Logger review workflow.

The imported-trade review workflow provides:

- A completeness summary for stop loss, setup type, session, regime, manual quality, notes, and Result R.
- An R completion rate with visible reasons when R is unavailable.
- A priority queue that handles missing stop loss, setup type, session, and manual quality before sorting by absolute PnL and newest entry.
- Per-trade completeness and Edge Lab eligibility indicators.
- Batch fill for session, setup type, regime, manual quality, and location.
- Optional batch stop loss only when the user explicitly enters a value; R is recalculated separately for each selected trade.
- Save & Next only after the Edge Lab eligibility fields are complete.
- Skip With Reason, which stores the reason in review notes while leaving the trade unreviewed.

Imported Result R remains `null` and displays as `--` until entry price, exit price, and a valid stop loss are available. A reviewed imported trade is ready for Edge Lab when it is a Taken trade with `result_r`, `setup_type`, `session`, and `manual_quality`. Regime and notes remain visible completeness fields for better research segmentation but are not hard Edge Lab eligibility gates.

## Market Data Engine v1

Market Lab is a data and detector validation workspace. It does not connect to live data, brokers, API keys, or order execution.

Open:

```text
http://localhost:3000/market-lab
```

Sample CSV:

```text
frontend/public/samples/nq-1m-sample.csv
```

CSV format:

```csv
symbol,timeframe,timestamp,open,high,low,close,volume
NQ,1m,2026-06-01T09:30:00,100.00,101.00,99.00,100.50,1200
```

Required columns:

- `timestamp`
- `open`
- `high`
- `low`
- `close`
- `volume`

Optional columns:

- `symbol`
- `timeframe`

Supported timeframes:

- `1m`
- `5m`

Use Market Lab for validation:

1. Open `/market-lab`.
2. Click `Load NQ Sample` or import your own 1m/5m CSV.
3. Review first candle, last candle, total rows, timeframe consistency, missing rows, and duplicate rows.
4. Inspect each swing, sweep, FVG, and setup candidate.
5. Mark each detector output as `Correct`, `Wrong`, or `Unsure`.
6. Add short notes when the detector disagrees with your manual read.
7. Click `Export Feedback` to download validation feedback as CSV.

Free Data Research Mode:

- Open `/market-lab`.
- In `Free Data Research Mode`, choose `NQ=F`, `MNQ=F`, or `GC=F`.
- Choose a Yahoo Finance range, then click `Download & Run`.
- The app saves the raw Yahoo response under `backend/data/yahoo_cache`.
- The downloaded candles feed the existing Structure Engine and Structure Sweep Detector.
- Yahoo Finance futures data is delayed and for research only. The app still has no broker connection, no live execution, and no auto trading.

Current detector rules:

- Swing high: current candle high is above both the previous and next candle highs.
- Swing low: current candle low is below both the previous and next candle lows.
- HH/LH: a swing high is compared against the previous swing high.
- HL/LL: a swing low is compared against the previous swing low.
- Sweep above high: candle trades above previous day high or active session high and closes back below that level.
- Sweep below low: candle trades below previous day low or active session low and closes back above that level.
- Bullish FVG: candle 1 high is below candle 3 low.
- Bearish FVG: candle 1 low is above candle 3 high.
- Sweep Reversal candidate: created from a sweep event only.
- Fabio Long candidate: recent sweep below low followed by bullish FVG inside the lookback window.
- Fabio Short candidate: recent sweep above high followed by bearish FVG inside the lookback window.

Detector validation feedback is stored locally in the browser under `fabio-market-validation-feedback-v1`.

## Local Development

### Fast Local Mode

For simple local use on Windows or Mac, the frontend now works even when Docker, PostgreSQL, and the FastAPI backend are not running. It first tries `http://localhost:8000`; if that is unavailable, Trade Logger, Dashboard, Setup Analyzer, Management Lab, Screenshot Library, and Research Lab use browser local storage.

Windows shortcut:

```text
Desktop/Fabio Edge Research Lab.lnk
```

Manual frontend launch:

```powershell
cd frontend
npm.cmd install
npm.cmd run dev
```

Then open:

```text
http://localhost:3000
```

Local-mode notes:

- Records are stored in the browser profile on that machine.
- CSV import/export works from the Trade Logger page.
- Screenshot uploads are stored as browser data URLs for local research.
- For shared/cloud-ready data, run the full Docker/PostgreSQL backend.

1. Copy environment defaults:

```bash
cp .env.example .env
```

2. Start the stack:

```bash
docker compose up --build
```

3. Open the app:

```text
http://localhost:3000
```

API docs are available at:

```text
http://localhost:8000/docs
```

### Mac Local Run

```bash
cp .env.example .env
docker compose up --build
```

Without Docker:

```bash
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### SEC EDGAR FCF fallback

Investment Lab can use SEC EDGAR company facts when the FMP cash-flow endpoint is blocked. Configure a declared SEC User-Agent in the backend environment:

```powershell
$env:SEC_USER_AGENT="your_name_or_email_for_sec_requests"
$env:SEC_MIN_REQUEST_INTERVAL_SECONDS="1.0"
```

The backend resolves ticker-to-CIK mappings from the SEC company ticker file, zero-pads CIKs to 10 digits, and fetches:

```text
https://data.sec.gov/api/xbrl/companyfacts/CIK##########.json
```

Responses are cached under `backend/data/sec_edgar`. The app prefers annual `FY` / `10-K` / `USD` facts, extracts operating cash flow and capital expenditure, and calculates:

```text
Free Cash Flow = Operating Cash Flow - absolute(CapEx)
```

Use **SEC EDGAR FCF Coverage Manager** in `/investment-lab` to fetch the next 10 or 25 candidates. This workflow does not use FMP calls. The SEC Raw Inspector shows the CIK, selected XBRL concepts, fiscal periods, sign normalization, and calculated annual FCF values.

### Investment Lab scanner diagnostics and local backup

Investment Lab includes a **Scanner Diagnostics** panel in the Stock Scanner tab. Use it before spending FMP quota. It shows:

- whether the local universe has loaded
- whether an FMP key is saved locally
- safe FMP calls remaining after quota reconciliation
- endpoint capability health
- empty or failed cache entries that should be repaired
- scan preview status and last batch ROI
- the most likely blocker when scanning does not produce valid stocks

The Diagnostics tab includes **Local Data Backup**. It exports a JSON backup of known Fabio Edge browser localStorage keys, including trade records, Investment Lab cache/settings, SEC/FMP cache, scan ROI history, watchlists, portfolio data, Market Lab validation feedback, freedom goals, checklist state, and preferences.

This is manual backup/restore only, not cloud synchronization. Backup files can include user research data and the locally saved FMP key if one exists, so store them privately and never commit them.

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

### Windows Local Run

```powershell
Copy-Item .env.example .env
docker compose up --build
```

Without Docker:

```powershell
cd backend
py -3.11 -m venv .venv
.venv\Scripts\activate
python -m pip install -U pip
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

PowerShell activation alternative:

```powershell
.\.venv\Scripts\Activate.ps1
```

In a second terminal:

```powershell
cd frontend
npm.cmd install
npm.cmd run dev
```

## Database Migration

Run these against an existing PostgreSQL database before launching the upgraded API:

```bash
psql "$DATABASE_URL" -f backend/app/db/migrations/002_trade_research_upgrade.sql
psql "$DATABASE_URL" -f backend/app/db/migrations/003_phase3_research_upgrade.sql
psql "$DATABASE_URL" -f backend/app/db/migrations/004_data_quality_risk_upgrade.sql
psql "$DATABASE_URL" -f backend/app/db/migrations/005_regime_label_v1.sql
psql "$DATABASE_URL" -f backend/app/db/migrations/006_market_data_engine_v1.sql
psql "$DATABASE_URL" -f backend/app/db/migrations/006_trade_logger_field_clarity.sql
psql "$DATABASE_URL" -f backend/app/db/migrations/007_market_candle_debug_metadata.sql
psql "$DATABASE_URL" -f backend/app/db/migrations/008_setup_type_edge_lab_v2.sql
psql "$DATABASE_URL" -f backend/app/db/migrations/009_broker_trade_import_v1.sql
psql "$DATABASE_URL" -f backend/app/db/migrations/010_tradovate_closed_trades_import.sql
```

Docker example:

```bash
docker compose exec -T postgres psql -U fabio -d fabio_edge < backend/app/db/migrations/002_trade_research_upgrade.sql
docker compose exec -T postgres psql -U fabio -d fabio_edge < backend/app/db/migrations/003_phase3_research_upgrade.sql
docker compose exec -T postgres psql -U fabio -d fabio_edge < backend/app/db/migrations/004_data_quality_risk_upgrade.sql
docker compose exec -T postgres psql -U fabio -d fabio_edge < backend/app/db/migrations/005_regime_label_v1.sql
docker compose exec -T postgres psql -U fabio -d fabio_edge < backend/app/db/migrations/006_market_data_engine_v1.sql
docker compose exec -T postgres psql -U fabio -d fabio_edge < backend/app/db/migrations/006_trade_logger_field_clarity.sql
docker compose exec -T postgres psql -U fabio -d fabio_edge < backend/app/db/migrations/007_market_candle_debug_metadata.sql
docker compose exec -T postgres psql -U fabio -d fabio_edge < backend/app/db/migrations/008_setup_type_edge_lab_v2.sql
docker compose exec -T postgres psql -U fabio -d fabio_edge < backend/app/db/migrations/009_broker_trade_import_v1.sql
docker compose exec -T postgres psql -U fabio -d fabio_edge < backend/app/db/migrations/010_tradovate_closed_trades_import.sql
```

The migration only adds columns, constraints, and indexes. It does not delete existing trade data.

## Services

- Frontend: `frontend`, port `3000`
- Backend API: `backend`, port `8000`
- PostgreSQL: `postgres`, port `5432`

## Backend Commands

Use a backend virtual environment to avoid global Python package conflicts.

### Windows Backend .venv

Run these from the project root:

```powershell
cd backend
py -3.11 -m venv .venv
.venv\Scripts\activate
python -m pip install -U pip
pip install -r requirements.txt
python -m pytest
```

If you use PowerShell and script activation is blocked, use:

```powershell
.\.venv\Scripts\Activate.ps1
```

Mac:

```bash
cd backend
python3.11 -m venv .venv
source .venv/bin/activate
python -m pip install -U pip
pip install -r requirements.txt
python -m pytest
```

`pytest` is included in `backend/requirements.txt`. The regression sample dataset lives in `backend/tests/sample_data.py` and contains 30 trades covering good, incomplete, and bad quality records plus Taken, Skipped, Watched, and Invalidated decisions. The tests pin expected outputs for win rate, average R, profit factor, max drawdown, data quality counts, Monte Carlo risk, and management grouping.

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
python -m pytest
```

On Windows PowerShell:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
python -m pytest
```

## Test Commands

Backend:

```bash
cd backend
python -m pytest
```

Backend tests through Docker:

```bash
docker compose run --rm backend-tests
```

Frontend:

```bash
cd frontend
npm run build
npm run lint
```

Full local validation:

Windows PowerShell:

```powershell
.\scripts\validate-ci.ps1
```

Windows Command Prompt:

```cmd
scripts\validate-ci.cmd
```

Mac/Linux:

```bash
bash scripts/validate-ci.sh
```

The validation script runs `npm run build`, `npm run lint`, and `docker compose run --rm backend-tests`.

## Frontend Commands

```bash
cd frontend
npm install
npm run dev
```

## Safety Boundaries

- No broker API is implemented.
- No order placement code exists.
- Analyzer output is statistical decision support only.
- Machine learning is disabled until there are at least 300 valid taken trades.
- Cloud sync is a reserved interface only; no remote sync is active.
- Screenshot AI, chart recognition, and order-flow automation are not implemented.

## Collaboration

The project uses a feature-branch and pull-request workflow. Keep `main` stable and do not develop directly on it.

Read:

- [PROJECT_GOAL.md](PROJECT_GOAL.md)
- [PROJECT_STATE.md](PROJECT_STATE.md)
- [RESEARCH_ROADMAP.md](RESEARCH_ROADMAP.md)
- [DATA_POLICY.md](DATA_POLICY.md)
- [DEVELOPMENT_WORKFLOW.md](DEVELOPMENT_WORKFLOW.md)
- [CONTRIBUTING.md](CONTRIBUTING.md)
- [Private GitHub setup](docs/GITHUB_SETUP.md)

### One-Click Investment Lab Launch

Recommended Windows workflow:

```powershell
start-investment-lab.bat
```

This launcher:

- starts the FastAPI backend on `http://127.0.0.1:8000`
- starts the Next.js frontend on `http://localhost:3000`
- checks that Next.js CSS assets load correctly; if stale `.next` cache causes CSS 404s, it restarts the frontend
- creates `backend\.venv` and installs backend requirements if the virtual environment is missing
- waits for `/health` and `/investment-lab`
- opens `http://localhost:3000/investment-lab?autoscan=local`
- automatically runs the free/local Stage 1 Investment Lab scan

The default `start-fabio-lab.bat` delegates to the same one-click Investment Lab launcher. FMP deep scan still requires Preview and Confirm because it can spend quota.

### Investment Lab Free Data Coverage

Investment Lab uses free sources conservatively and keeps missing data visible instead of filling fake defaults.

- SEC EDGAR XBRL is the main no-key fallback for company financial statements. It can fill FCF history, revenue growth, net margin, ROE, debt/equity, and shares outstanding when the issuer reports comparable XBRL facts.
- The SEC Coverage Manager can run a full free SEC backfill in 25-symbol batches. This may take several minutes for hundreds of tickers because the app respects SEC rate limits and local caching.
- FMP free-plan endpoints are used only when the user provides an FMP key and the endpoint is available under the current plan. Premium-blocked endpoints stay remembered and are not retried.
- FMP historical EOD is still the preferred free-plan path for current price proxy, historical close, 52-week drawdown, and volatility when available.
- Experimental Yahoo and public CSV sources are not treated as primary because browser/CORS/anti-bot restrictions can make them unreliable.
- Generic web scraping is intentionally not used as a primary source. If a future adapter scrapes public pages, it must be marked low reliability, cached, source-audited, and must not overwrite higher-quality SEC, FMP, or manual data.

No free source can guarantee 100% coverage. If a company does not report a field, an endpoint is blocked by plan, or price history is unavailable, Data Coverage shows the exact missing reason and allows manual input.

### Start Frontend

```powershell
start-frontend.bat
```

Manual equivalent:

```powershell
cd frontend
npm.cmd install
npm.cmd run dev -- --port 3000
```

Open `http://localhost:3000/investment-lab`.

### Start Backend

Create and activate the backend environment:

```powershell
cd backend
py -3.11 -m venv .venv
.venv\Scripts\activate
python -m pip install -U pip
pip install -r requirements.txt
```

Start it with:

```powershell
start-backend.bat
```

Manual equivalent:

```powershell
cd backend
.venv\Scripts\activate
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

API health is available at `http://127.0.0.1:8000/health`.

### Validate Before Merge

```powershell
cd frontend
npm.cmd run build
npm.cmd run lint
cd ..
backend\.venv\Scripts\python.exe -m pytest
scripts\check-secrets.cmd
```

### Environment And Secret Safety

`.env.example` contains placeholders only. Put real values in an ignored `.env` or `.env.local` file. The frontend recognizes `NEXT_PUBLIC_API_BASE`; only variables prefixed with `NEXT_PUBLIC_` are safe to expose to browser code.

Current Investment Lab behavior accepts the FMP key through its local UI and stores local settings in the browser profile. Use a dedicated limited-quota key, never paste it into source code, Markdown, screenshots, issue reports, or logs, and do not export browser storage containing the key.

Before each commit:

```powershell
scripts\check-secrets.cmd
git status
git diff --cached
```

The repository pre-commit hook runs the same secret check when `core.hooksPath` is configured to `.githooks`.

### Rotate An Exposed Key

If an FMP key or other credential is exposed:

1. Disable or regenerate it immediately in the provider dashboard.
2. Remove it from local files and browser storage.
3. Replace it with the new key only in an ignored local environment or local UI.
4. Search the repository and Git history for the old value.
5. If it was pushed, treat it as compromised even after deleting the file and coordinate Git history cleanup before collaborators pull again.

Never commit raw FMP/SEC cache responses, portfolio exports, account statements, or personal SEC contact details.
