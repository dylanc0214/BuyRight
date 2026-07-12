#!/bin/bash
# KeretaAI - Local Database Setup Script
# Usage: bash database/setup.sh
# Creates keretaai_user, keretaai_local database, runs schema + seed

set -e

DB_NAME="keretaai_local"
DB_USER="keretaai_user"
DB_PASS="local_password"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "========================================"
echo "  KeretaAI - Local Database Setup"
echo "========================================"

# Ensure PostgreSQL is running
if ! pg_isready -q; then
  echo "⚠️  PostgreSQL is not running. Attempting to start..."
  brew services start postgresql@15
  sleep 3
fi

echo "✅ PostgreSQL is running"

# Create role if not exists
psql postgres -tc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1 || \
  psql postgres -c "CREATE ROLE ${DB_USER} WITH LOGIN PASSWORD '${DB_PASS}';"
echo "✅ Role '${DB_USER}' ready"

# Create database if not exists
psql postgres -tc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1 || \
  psql postgres -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"
echo "✅ Database '${DB_NAME}' ready"

# Grant privileges
psql postgres -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};" > /dev/null

# Run schema
echo "⏳ Running schema..."
psql -U "${DB_USER}" -d "${DB_NAME}" -f "${SCRIPT_DIR}/schema.sql"
echo "✅ Schema created"

# Run seed
echo "⏳ Seeding 100 cars, 28 sellers, 14 users..."
psql -U "${DB_USER}" -d "${DB_NAME}" -f "${SCRIPT_DIR}/seed.sql"
echo "✅ Seed data inserted"

# Verify
COUNT=$(psql -U "${DB_USER}" -d "${DB_NAME}" -t -c "SELECT COUNT(*) FROM cars;")
echo ""
echo "========================================"
echo "  Setup complete! ${COUNT// /} cars loaded."
echo "  Host:     localhost:5432"
echo "  Database: ${DB_NAME}"
echo "  User:     ${DB_USER}"
echo "========================================"
