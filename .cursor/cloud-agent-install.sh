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
fi

echo "node $(node -v) / npm $(npm -v)"
npm install
