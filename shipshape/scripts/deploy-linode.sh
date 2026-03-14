#!/bin/bash
# Quick deploy script for Linode VPS
# Run from shipshape/ root

set -e

# Kill any existing instances
pkill -f "node dist/index.js" 2>/dev/null || true
pkill -f "serve dist" 2>/dev/null || true
sleep 1

# API
cd "$(dirname "$0")/../api"
CORS_ORIGIN="http://45.33.3.111:5173" PORT=3000 nohup node dist/index.js > /tmp/ship-api.log 2>&1 &
echo "API started (pid $!, log: /tmp/ship-api.log)"

# Web
cd "$(dirname "$0")/../web"
nohup npx serve dist -l 5173 -s > /tmp/ship-web.log 2>&1 &
echo "Web started (pid $!, log: /tmp/ship-web.log)"

echo ""
echo "App: http://45.33.3.111:5173"
echo "API: http://45.33.3.111:3000"
echo "Logs: tail -f /tmp/ship-api.log /tmp/ship-web.log"
