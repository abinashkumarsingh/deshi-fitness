#!/bin/sh
# Writes runtime config so the same image works with any API URL (no rebuild needed).
API="${API_URL:-${VITE_API_URL:-http://localhost:4000}}"
NAME="${APP_NAME:-${VITE_APP_NAME:-Deshi Fitness}}"
cat > /usr/share/nginx/html/config.js <<CFG
window.__CONFIG__ = { API_URL: "${API}", APP_NAME: "${NAME}" };
CFG
echo "Deshi config: API_URL=${API}"
