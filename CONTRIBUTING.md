# Contributing

## Setup

Clone the private repository and enter the project:

```powershell
git clone <private-repository-url>
cd project-name-fabio-edge-research-lab
```

Configure your own commit identity:

```powershell
git config user.name "Your Name"
git config user.email "your-github-email@example.com"
```

Create the backend environment:

```powershell
cd backend
py -3.11 -m venv .venv
.venv\Scripts\activate
python -m pip install -U pip
pip install -r requirements.txt
cd ..
```

Install the frontend:

```powershell
cd frontend
npm.cmd install
cd ..
```

Copy `.env.example` only when local environment variables are needed. Store real values in ignored `.env` or `.env.local` files. Never edit `.env.example` with a real key.

Start the services in separate terminals:

```powershell
start-backend.bat
start-frontend.bat
```

## Create a Branch

```powershell
git switch main
git pull --ff-only
git switch -c feature/short-description
```

Use `feature/`, `fix/`, or `docs/` prefixes. Keep each branch focused on one change.

## Validate

Before committing:

```powershell
scripts\check-secrets.cmd
cd frontend
npm.cmd run build
npm.cmd run lint
cd ..
backend\.venv\Scripts\python.exe -m pytest
```

Review the exact files being committed:

```powershell
git status
git diff
git diff --cached
```

## Submit a Pull Request

```powershell
git add <files>
git commit -m "Describe the focused change"
git push -u origin feature/short-description
```

Open a pull request into `main`. Include:

- problem and intended behavior
- implementation summary
- validation results
- screenshots for visible UI changes
- data migration or compatibility notes
- known limitations

Request the other collaborator for review when the change affects calculations, stored data, API behavior, security, or shared architecture.

## Report Bugs

Create a GitHub issue with:

- page or API endpoint
- exact reproduction steps
- expected and actual behavior
- browser and operating system
- relevant console or backend error text with secrets removed
- whether localStorage, FMP, SEC, or PostgreSQL data was involved

Do not attach `.env` files, API keys, raw account exports, or private trading records.
