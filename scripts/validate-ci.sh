#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$ROOT_DIR/frontend"
npm run build
npm run lint

cd "$ROOT_DIR"
if ! command -v docker >/dev/null 2>&1; then
  echo "Docker CLI was not found. Install Docker Desktop and ensure docker is available on PATH, then rerun this script." >&2
  exit 1
fi
docker compose run --rm backend-tests
