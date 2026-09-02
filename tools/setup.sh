#!/usr/bin/env bash
# One-time per machine/session: local three.js + Playwright + ffmpeg, and the local server.
# Everything lands in tools/node_modules (git-ignored). Run from anywhere.
set -e
cd "$(dirname "$0")"
[ -f package.json ] || npm init -y >/dev/null
npm install --no-audit --no-fund --silent three@0.160.0 playwright @ffmpeg-installer/ffmpeg
pip install --quiet pillow numpy 2>/dev/null || true
cd ..
PORT="${MG_PORT:-8123}"
if ! curl -s -o /dev/null "http://localhost:$PORT/index.html"; then
  (setsid python3 -m http.server "$PORT" >/dev/null 2>&1 &) ; sleep 1
fi
echo "ready: http://localhost:$PORT/index.html"
