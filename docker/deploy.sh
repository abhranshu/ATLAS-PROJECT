#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

MODE="${1:-dev}"

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Created .env from .env.example — edit secrets before production deploy."
fi

if [[ "$MODE" == "prod" ]]; then
  if grep -q "change-me" .env 2>/dev/null || grep -q "change-this" .env 2>/dev/null; then
    echo "ERROR: Update POSTGRES_PASSWORD, JWT_SECRET, DOMAIN, and ACME_EMAIL in .env first."
    exit 1
  fi
  if ! grep -q "^DOMAIN=.\+" .env; then
    echo "ERROR: Set DOMAIN in .env for production (e.g. DOMAIN=atlas.example.com)."
    exit 1
  fi
  echo "Starting Atlas in PRODUCTION mode (HTTPS via Caddy)..."
  docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
  echo ""
  echo "Deployed. Open: https://$(grep '^DOMAIN=' .env | cut -d= -f2-)"
else
  echo "Starting Atlas in DEV mode..."
  docker compose up -d --build
  echo ""
  echo "Dashboard: http://localhost:${FRONTEND_PORT:-8080}"
  echo "API docs:  http://localhost:${FRONTEND_PORT:-8080}/docs"
fi

docker compose ps
