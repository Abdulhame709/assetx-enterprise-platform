#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WEB_DIR="$ROOT_DIR/web"
BACKEND_ENV_FILE="${BACKEND_ENV_FILE:-/home/ubuntu/assetx-runtime/backend.local.env}"
WEB_PORT="${WEB_PORT:-3010}"
API_PROXY_TARGET="${API_PROXY_TARGET:-http://127.0.0.1:3001}"
LOG_FILE="${LOG_FILE:-/tmp/assetx-web-prod-${WEB_PORT}.log}"
PID_FILE="${PID_FILE:-/tmp/assetx-web-prod-${WEB_PORT}.pid}"

if [[ ! -f "$BACKEND_ENV_FILE" ]]; then
  echo "Backend env file not found: $BACKEND_ENV_FILE" >&2
  exit 1
fi

if ! curl --fail --silent --show-error --max-time 5 "$API_PROXY_TARGET/health" >/tmp/assetx-preview-backend-health.json; then
  echo "Backend is not healthy at $API_PROXY_TARGET" >&2
  exit 1
fi

if ss -ltn "sport = :$WEB_PORT" | grep -q LISTEN; then
  echo "Port $WEB_PORT is already in use. Stop the existing process or choose another WEB_PORT." >&2
  exit 1
fi

cd "$WEB_DIR"
nohup env PORT="$WEB_PORT" API_PROXY_TARGET="$API_PROXY_TARGET" npm start >"$LOG_FILE" 2>&1 &
echo $! >"$PID_FILE"

for _ in $(seq 1 20); do
  if curl --fail --silent --max-time 3 "http://127.0.0.1:${WEB_PORT}/api/health" >/tmp/assetx-preview-web-health.json; then
    echo "AssetX production web is ready: http://127.0.0.1:${WEB_PORT}"
    echo "Public exposure can be added to port ${WEB_PORT} after this check."
    echo "PID file: $PID_FILE"
    echo "Log file: $LOG_FILE"
    exit 0
  fi
  sleep 1
done

echo "Production web did not become ready. Inspect: $LOG_FILE" >&2
exit 1
