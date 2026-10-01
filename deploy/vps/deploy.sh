#!/usr/bin/env bash
set -euo pipefail

cd /opt/tratosapp
test -s /etc/tratosapp/api.env

docker compose -p tratosapp -f deploy/vps/docker-compose.yml up -d --no-build --force-recreate api

for attempt in $(seq 1 45); do
  if docker compose -p tratosapp -f deploy/vps/docker-compose.yml exec -T api node -e \
    "fetch('http://127.0.0.1:3000/api/v1/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"; then
    docker compose -p tratosapp -f deploy/vps/docker-compose.yml ps
    exit 0
  fi
  sleep 2
done

docker compose -p tratosapp -f deploy/vps/docker-compose.yml logs --tail=100 api
exit 1
