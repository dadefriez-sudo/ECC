#!/usr/bin/env bash
# Runs the accountability API tests against the real routes and an in-memory Postgres.
#   cd backend && bash test/accountability/run.sh
set -e
cd "$(dirname "$0")"
node db-server.mjs & DB=$!
trap 'kill $DB $API 2>/dev/null' EXIT
sleep 6
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5544/postgres node --import ./register.mjs run-backend.mjs & API=$!
sleep 4
node api-test.mjs
