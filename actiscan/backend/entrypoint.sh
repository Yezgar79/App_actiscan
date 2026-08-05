#!/bin/sh
set -e

echo "Running database migrations..."
alembic upgrade head

echo "Running database seed..."
python seed.py

echo "Starting uvicorn..."
exec uvicorn main:app --host 0.0.0.0 --port 8000 --reload
