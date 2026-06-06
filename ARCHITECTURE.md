# Liam Trading Brain Architecture

## System Shape

Liam Trading Brain is a local-first web application with a Next.js frontend and a FastAPI backend. PostgreSQL is the intended persistent database. The frontend can operate without the backend by using browser localStorage fallback APIs.

```text
frontend/
  app/                  Next.js routes
  components/           UI and feature components
  lib/                  API client, local fallback, engines, constants, i18n
backend/
  app/
    api/routes/         FastAPI route handlers
    db/                 schema and SQL migrations
    models/             SQLAlchemy models
    schemas/            Pydantic request/response schemas
    services/           analytics, scoring, probability, market data engines
  tests/                backend regression tests
ml/                     ML-ready placeholders only, no training
```

## Frontend Architecture

- `frontend/app/*/page.tsx` routes render feature components.
- `frontend/components/layout/app-shell.tsx` owns navigation, theme toggle, and language selector.
- `frontend/lib/api.ts` calls FastAPI first and falls back to `frontend/lib/local-store.ts` when the backend is unavailable.
- `frontend/lib/local-store.ts` mirrors key backend analytics and persistence behavior for local browser use.
- `frontend/lib/market-engine.ts` handles client-side market CSV parsing and detector logic for Market Lab fallback.
- `frontend/lib/i18n.ts` contains lightweight language labels and option display mappings.

## Backend Architecture

- `backend/app/main.py` creates the FastAPI app and registers routers.
- `backend/app/models/trade.py` is the main SQLAlchemy trade model.
- `backend/app/schemas/trade.py` defines create/update/read validation.
- `backend/app/api/routes/trades.py` handles CRUD, CSV import/export, screenshots, POC risk normalization, data quality, and setup score recalculation.
- `backend/app/services/scoring.py` is the rule-based setup score engine.
- `backend/app/services/probability.py` is the weighted similarity and historical probability engine.
- `backend/app/services/management.py` compares management rules.
- `backend/app/services/market_data.py` handles candle CSV parsing and market detectors.
- `backend/app/db/migrations/` contains additive SQL migrations.

## Core Data Model

Primary table: `trades`.

Important fields:

- Identity/sync: `id`, `user_id`, `workspace_id`
- Setup context: `date`, `instrument`, `data_type`, `session`, `direction`, `bias_15m`, `market_state`, `regime_label`, `location`
- Structure labels: `liquidity_sweep`, `choch`, `lh_hl`, `fvg_reaction`, `volume_state`
- Quality/scoring: `setup_score`, `manual_quality`, `data_quality`
- Execution: `entry_price`, `stop_loss`, `tp1_price`, `tp2_price`, `risk_amount`, `result`, `result_r`, `mfe`, `mae`
- POC risk: `distance_to_poc`, `distance_to_vah`, `distance_to_val`, `poc_risk_level`
- Review: `followed_plan`, `mistake_type`, `discipline_score`, `execution_score`, `emotion_score`, `review_notes`, `lessons_learned`
- Media: `screenshot_path`, `screenshot_tags`, `screenshot_favorite`, `screenshot_bookmarked`, `screenshot_notes`

Market data tables:

- `market_candles` stores OHLCV candles.
- `setup_candidate_logs` stores detected paper setup candidates.

## Detector Architecture

Market Lab detectors are data-only. They do not trade.

- CSV adapter accepts TradingView exports and ignores unknown indicator columns.
- Missing rows and duplicate candles are detected during import.
- Session detector labels Asia, London, Pre-Market, New York, and After-Hours.
- Swing Detector V1 remains available and is still used by setup candidates.
- Swing Detector V2 is used for cleaner Market Structure display:
  - mode: strict, normal, aggressive
  - left/right candle count
  - minimum swing distance
  - swing score from size, displacement, volume
  - accepted-swing explanation
- Structure Importance Engine V1 adds `structure_importance_score` and reason to V2 swings.
- Sweep, FVG, and setup candidate logic should not be changed when tuning Swing V2 unless explicitly requested.

## i18n Architecture

Language state is stored in localStorage under `fabio-language`.

- `AppShell` changes language and dispatches `fabio-language-change`.
- Feature components can listen for that event or read `getStoredLanguage()`.
- Option values remain canonical English enum values; `optionLabel(language, value)` only changes display text.
- This avoids breaking backend constraints, CSV exports, and existing records.

## Extension Guidelines

- Prefer additive migrations with `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`.
- Do not delete or rewrite existing user data.
- Keep browser localStorage fallback aligned with backend services.
- Keep detector changes transparent: expose reason text and enough candle references for manual validation.
- Add tests for scoring, data quality, detectors, CSV import, and migrations when behavior changes.
- Do not add broker connectivity or automatic execution.
