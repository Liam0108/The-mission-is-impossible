# Development Workflow

This repository uses a two-person review workflow. The purpose is to keep `main` stable while allowing either collaborator to work independently.

## Branch Rules

- `main` must always build, lint, and pass backend tests.
- Do not develop directly on `main`.
- Create one feature branch for each focused change.
- Keep unrelated refactors out of the same pull request.
- Use a pull request before merging into `main`.
- Important changes require review from the other collaborator.

Branch naming examples:

```text
feature/investment-scan-roi
fix/fmp-cache-repair
docs/setup-guide
```

Create a branch:

```powershell
git switch main
git pull --ff-only
git switch -c feature/short-description
```

## Daily Workflow

1. Pull the latest stable `main`.
2. Create a new branch.
3. Make a focused change.
4. Run the secret check and validation commands.
5. Review `git diff` and `git status`.
6. Commit with a clear message.
7. Push the feature branch.
8. Open a pull request and request review.
9. Merge only after review and validation pass.
10. Delete the merged feature branch.

## Required Validation

Run from the project root before requesting review:

```powershell
cd frontend
npm.cmd run build
npm.cmd run lint
cd ..
backend\.venv\Scripts\python.exe -m pytest
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\check-secrets.ps1
```

The equivalent short commands are:

```powershell
scripts\check-secrets.cmd
```

## Commit Guidance

Use short, action-oriented commit messages:

```text
Add hybrid completion queue diagnostics
Fix FMP cache freshness handling
Document SEC fallback setup
```

Do not commit:

- `.env` or `.env.local`
- FMP keys, personal SEC contact details, tokens, or credentials
- `backend/data` API response caches
- browser exports containing private portfolio or trading data
- screenshots with account identifiers
- generated `.next`, `node_modules`, `.venv`, logs, or temporary files

## Merge Policy

Prefer squash merge for focused pull requests. Rebase or update the branch if `main` changed significantly. Never force-push `main`.

For scoring, DCF, recommendation, FMP/SEC mapping, database migrations, or data-loss risks, the reviewer should inspect both the implementation and its tests.

