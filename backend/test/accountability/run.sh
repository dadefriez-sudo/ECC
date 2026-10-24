#!/usr/bin/env bash
# Runs the API tests (accountability, cloud sync) against the real routes and an
# in-memory Postgres.
#   cd backend && bash test/accountability/run.sh
set -e
cd "$(dirname "$0")"

# Wait until something is listening on a port, instead of guessing with sleeps
# (a slow machine, like a CI runner, needs longer than a fast one).
wait_for_port() {
  for _ in $(seq 1 90); do
    if (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null; then return 0; fi
    sleep 1
  done
  echo "Timed out waiting for port $1" >&2
  return 1
}

node db-server.mjs & DB=$!
trap 'kill $DB $API 2>/dev/null' EXIT
wait_for_port 5544
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5544/postgres node --import ./register.mjs run-backend.mjs & API=$!
wait_for_port 4100
node api-test.mjs
