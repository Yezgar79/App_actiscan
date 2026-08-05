#!/bin/sh
set -e

echo "Running database migrations..."
alembic upgrade head

if [ "${SEED_ON_STARTUP:-true}" = "true" ]; then
    echo "Running database seed..."
    python seed.py
fi

echo "Starting uvicorn..."
exec uvicorn main:app --host 0.0.0.0 --port "${PORT:-8000}"
