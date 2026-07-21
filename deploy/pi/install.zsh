#!/usr/bin/env zsh
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  print -u2 "Bitte mit sudo ausführen: sudo ./deploy/pi/install.zsh"
  exit 1
fi

SOURCE_DIR="${0:A:h:h:h}"
INSTALL_DIR="/opt/claims-ai-portfolio/current"
STATE_DIR="/var/lib/claims-ai"
ENV_FILE="/etc/claims-ai-portfolio.env"

apt-get update
apt-get install -y --no-install-recommends bubblewrap socat ripgrep rsync ca-certificates curl openssl zsh

if ! id claims-ai >/dev/null 2>&1; then
  useradd --system --create-home --home-dir "${STATE_DIR}" --shell /usr/sbin/nologin claims-ai
fi
install -d -o claims-ai -g claims-ai -m 0700 "${STATE_DIR}" "${STATE_DIR}/workspace" "${STATE_DIR}/ai-operations"
install -d -o root -g root -m 0755 "${INSTALL_DIR}"

rsync -a --delete \
  --exclude .git \
  --exclude .local \
  --exclude workspace \
  --exclude node_modules \
  --exclude dist \
  "${SOURCE_DIR}/" "${INSTALL_DIR}/"
chown -R claims-ai:claims-ai /opt/claims-ai-portfolio

if [[ ! -x "${STATE_DIR}/.bun/bin/bun" ]]; then
  sudo -u claims-ai env HOME="${STATE_DIR}" zsh -c 'curl -fsSL https://bun.sh/install | bash'
fi

sudo -u claims-ai env \
  HOME="${STATE_DIR}" \
  PATH="${STATE_DIR}/.bun/bin:/usr/local/bin:/usr/bin:/bin" \
  zsh -c "bun add --global @anthropic-ai/claude-code@2.1.215 && cd '${INSTALL_DIR}' && bun install --frozen-lockfile && bun run build"

if [[ ! -f "${ENV_FILE}" ]]; then
  read -r -s "APP_PASSWORD?Passwort für den Benutzer testing: "
  print
  if [[ -z "${APP_PASSWORD}" ]]; then
    print -u2 "Das Passwort darf nicht leer sein."
    exit 1
  fi
  PASSWORD_HASH="$(print -rn -- "${APP_PASSWORD}" | sudo -u claims-ai env HOME="${STATE_DIR}" "${STATE_DIR}/.bun/bin/bun" -e 'console.log(await Bun.password.hash(await Bun.stdin.text()))')"
  SESSION_SECRET="$(openssl rand -hex 32)"
  umask 077
  {
    print 'APP_AUTH_USERNAME=testing'
    print -r -- "APP_AUTH_PASSWORD_HASH=${PASSWORD_HASH}"
    print -r -- "APP_SESSION_SECRET=${SESSION_SECRET}"
    print -r -- "WORKSPACE_PATH=${STATE_DIR}/workspace"
  } > "${ENV_FILE}"
  chown root:claims-ai "${ENV_FILE}"
  chmod 0640 "${ENV_FILE}"
fi

install -o root -g root -m 0644 "${INSTALL_DIR}/deploy/pi/claims-ai-portfolio.service" /etc/systemd/system/claims-ai-portfolio.service
systemctl daemon-reload
systemctl enable claims-ai-portfolio.service

print "Installation abgeschlossen. Vor dem ersten Start Claude einmalig authentifizieren:"
print "sudo -u claims-ai env HOME=${STATE_DIR} CLAUDE_CONFIG_DIR=${STATE_DIR}/.claude PATH=${STATE_DIR}/.bun/bin:\$PATH claude auth login"
print "Danach: sudo systemctl start claims-ai-portfolio"
print "Cloudflare Tunnel muss auf http://127.0.0.1:3210 zeigen."
