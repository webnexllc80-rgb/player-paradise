#!/usr/bin/env bash
# Run ON THE VPS as root (after SSH). Set ADMIN_PASS before running:
#   export ADMIN_PASS='your_secure_password'
#   bash scripts/vps-set-admin-env-and-deploy.sh

set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/player-paradise}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@playersparadisehub.com}"
ADMIN_USERNAME="${ADMIN_USERNAME:-superadmin}"
ADMIN_USERNAME_ALIAS="${ADMIN_USERNAME_ALIAS:-admin}"
ADMIN_PASS="${ADMIN_PASS:-Paradise@2026!}"

cd "$APP_DIR"
touch .env

upsert_env() {
  local key="$1"
  local value="$2"
  if grep -q "^${key}=" .env; then
    sed -i "s|^${key}=.*|${key}=${value}|" .env
  else
    echo "${key}=${value}" >> .env
  fi
}

upsert_env ADMIN_EMAIL "$ADMIN_EMAIL"
upsert_env ADMIN_USERNAME "$ADMIN_USERNAME"
upsert_env ADMIN_USERNAME_ALIAS "$ADMIN_USERNAME_ALIAS"
upsert_env ADMIN_PASSWORD "$ADMIN_PASS"

git pull origin main
npm install
npm run build
pm2 restart all
pm2 status

echo "Done. Admin login syncs from .env on app start."