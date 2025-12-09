#!/usr/bin/env bash
set -euo pipefail

SERVICE_NAME="onlygantt-web"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NODE_BIN="$(command -v node || true)"

if [[ $(id -u) -ne 0 ]]; then
  echo "Questo script deve essere eseguito con privilegi di root (ad esempio usando sudo)." >&2
  exit 1
fi

if [[ -z "${NODE_BIN}" ]]; then
  echo "Node.js non trovato nel PATH. Installa Node.js o aggiungilo al PATH." >&2
  exit 1
fi

cat <<SERVICE | tee "${SERVICE_FILE}" > /dev/null
[Unit]
Description=OnlyGANTT Webserver
After=network.target

[Service]
Type=simple
WorkingDirectory=${PROJECT_ROOT}
ExecStart=${NODE_BIN} ${PROJECT_ROOT}/server/server.js
Environment=NODE_ENV=production
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
SERVICE

systemctl daemon-reload
systemctl enable --now "${SERVICE_NAME}.service"

systemctl status --no-pager "${SERVICE_NAME}.service"
