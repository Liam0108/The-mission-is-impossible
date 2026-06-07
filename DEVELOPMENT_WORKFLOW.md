# Development Workflow

This repository uses a two-person, research-first review workflow. The purpose
is to keep `main` stable, preserve working data flows, and prevent unsupported
research conclusions.

## Branch Rules

- `main` must always build, lint, and pass backend tests.
- Do not develop directly on `main`.
- Pull the latest `main` before creating a branch.
- Use one focused branch and pull request per change.
- Keep unrelated refactors out of the pull request.
- Important changes require review from the other collaborator.

Branch naming examples:

```text
feature/investment-scan-roi
fix/fmp-cache-repair
docs/research-direction-alignment
```

Create a branch:

```powershell
git switch main
git pull --ff-only
git switch -c feature/short-description
```

## Before Implementation

1. Read `PROJECT_GOAL.md`, `PROJECT_STATE.md`, `RESEARCH_ROADMAP.md`, and
   `DATA_POLICY.md`.
2. Search the current architecture for an existing implementation before adding
   another feature.
3. Identify the exact module and stored-data contracts affected.
4. Define the research question, input data, output, eligibility rules, and
   failure behavior.
5. Confirm that the request does not cross a permanent product boundary.
6. Do not modify Market Lab unless the request explicitly targets Market Lab.

## Data and Model Change Gate

For parser, analytics, scoring, DCF, simulation, or recommendation changes,
document:

- Source fields and normalization.
- Missing, empty, failed, stale, and fallback behavior.
- Whether existing records remain backward compatible.
- Which records are eligible for the calculation.
- Confidence, sample-size, or data-coverage implications.
- Audit output available to the user.
- Regression tests and representative fixtures.

Do not add a complex mathematical model until its required data, baseline,
validation method, explanation, and research-only warning are clear.

## Daily Workflow

1. Pull the latest stable `main`.
2. Create a focused branch.
3. Inspect existing code, tests, and documentation.
4. Make the smallest compatible change.
5. Add or update parser/model tests where behavior changes.
6. Update `PROJECT_STATE.md` and README when behavior changes.
7. Run secret checks and required validation.
8. Review `git diff`, `git diff --check`, and `git status`.
9. Commit with a clear message and push the feature branch.
10. Open a pull request and request review.
11. Merge only after review and validation pass.

## Required Validation

Run from the project root before requesting review:

```powershell
cd frontend
npm.cmd run build
npm.cmd run lint
cd ..
backend\.venv\Scripts\python.exe -m pytest
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\check-secrets.ps1
git diff --check
```

For documentation-only work, run the same validation unless the user explicitly
sets a narrower requirement. Confirm that `git diff --name-only` contains only
documentation files.

## Review Checklist

- The change answers a defined research or usability problem.
- Existing working flows remain intact.
- No duplicate feature or conflicting source of truth was introduced.
- Missing data cannot appear as valid or confident data.
- Source, timestamp, cache, fallback, and confidence remain visible where
  applicable.
- Tests cover parser or model behavior and important failure cases.
- Scoring weights and DCF assumptions changed only when explicitly requested.
- Research-only and safety warnings remain visible.
- No secrets, raw broker exports, API caches, or user records are included.

## Commit Guidance

Use short, action-oriented commit messages:

```text
Document research-first product direction
Fix FMP cache freshness handling
Add Tradovate import regression fixture
```

Stage only intended files. Avoid `git add -A` when the worktree contains
unrelated changes.

Do not commit:

- `.env` or `.env.local`.
- FMP keys, personal SEC contact details, tokens, or credentials.
- `backend/data` API response caches.
- Browser exports containing private portfolio or trading data.
- Raw broker CSV exports.
- Screenshots with account identifiers.
- Generated `.next`, `node_modules`, `.venv`, logs, or temporary files.

## Pull Requests and Merge Policy

The pull request should explain:

- Problem and intended research behavior.
- Implementation and compatibility impact.
- Data source and missing-data behavior when relevant.
- Tests and validation results.
- Migration, cache, or localStorage implications.
- Known limitations.

Prefer squash merge for focused changes. Update the branch if `main` has moved.
Never force-push or push implementation commits directly to `main`.

For scoring, DCF, recommendations, FMP/SEC mappings, broker CSV parsers,
database migrations, or data-loss risks, the reviewer must inspect both the
implementation and its tests.

## Permanent Restrictions

- No live broker connection.
- No order execution or automatic trading.
- No guaranteed-return or financial-advice language.
- No ML training without an explicit request and clean-data readiness.
- No Market Lab changes without an explicit Market Lab request.
- No committed secrets or private user data.

