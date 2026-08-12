#!/bin/sh
set -e

host="${DB_HOST:-db}"
port="${DB_PORT:-5432}"

echo "Waiting for PostgreSQL at ${host}:${port}..."
until python -c "import socket; s=socket.socket(); s.settimeout(2); s.connect(('${host}', ${port})); s.close()" 2>/dev/null; do
  sleep 1
done
echo "PostgreSQL is ready."

exec uvicorn app.main:app --host 0.0.0.0 --port 8000
