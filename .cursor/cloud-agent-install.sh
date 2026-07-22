#!/usr/bin/env bash
# Idempotent Cloud Agent update script (environment.json → install).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

NODE_WANT="$(tr -d '[:space:]' < .node-version 2>/dev/null || echo 24.16.0)"
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck disable=SC1091
if [ -s "$NVM_DIR/nvm.sh" ]; then
  . "$NVM_DIR/nvm.sh"
  nvm install "$NODE_WANT"
  nvm alias default "$NODE_WANT" >/dev/null
  nvm use "$NODE_WANT"
  # /exec-daemon/node can shadow nvm; put the selected Node first.
  NODE_BIN="$(nvm which "$NODE_WANT")"
  export PATH="$(dirname "$NODE_BIN"):$PATH"
  hash -r 2>/dev/null || true
fi

echo "node $(command -v node) $(node -v) / npm $(command -v npm) $(npm -v)"
MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$MAJOR" -lt 24 ]; then
  echo "ERROR: need Node >= 24 (got $(node -v)); check nvm / PATH" >&2
  exit 1
fi

npm install
