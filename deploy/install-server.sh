#!/usr/bin/env bash
# Run as root from the unpacked repository deployment bundle on likh.
set -euo pipefail
test "$(id -u)" -eq 0
test -f deploy/release_mirror.py
SITE=/www/wwwroot/spacepreview.likh.cn
VHOST=/www/server/panel/vhost/nginx/html_spacepreview.likh.cn.conf
EXTENSION=/www/server/panel/vhost/nginx/extension/spacepreview.likh.cn
BACKUP="/srv/spacepreview-backups/$(date -u +%Y%m%dT%H%M%SZ)"
install -d -m 700 "$BACKUP"
tar -czf "$BACKUP/website.tar.gz" -C "$SITE" .
cp -a "$VHOST" "$BACKUP/vhost.conf"
cp -a "$EXTENSION" "$BACKUP/nginx-extension"
for existing in /etc/systemd/system/spacepreview-release-sync.{service,timer} /opt/spacepreview-release-mirror; do
  if [ -e "$existing" ]; then cp -a "$existing" "$BACKUP/"; fi
done
tar -tzf "$BACKUP/website.tar.gz" >/dev/null
if ! id spacepreview-deploy >/dev/null 2>&1; then
  useradd --system --create-home --home-dir /var/lib/spacepreview-deploy --shell /bin/bash spacepreview-deploy
fi
# The upload key can neither edit its own authorized_keys nor modify the sync code.
chown -R root:root /var/lib/spacepreview-deploy
chmod 755 /var/lib/spacepreview-deploy
install -d -m 755 /var/lib/spacepreview-deploy/.ssh
install -d -m 755 /opt/spacepreview-release-mirror
install -m 644 deploy/release_mirror.py /opt/spacepreview-release-mirror/release_mirror.py
install -d -o spacepreview-deploy -g spacepreview-deploy -m 755 /srv/spacepreview-downloads
install -d -o spacepreview-deploy -g spacepreview-deploy -m 755 /srv/spacepreview-downloads/releases
install -d -o spacepreview-deploy -g spacepreview-deploy -m 700 /srv/spacepreview-downloads/staging
install -m 644 deploy/spacepreview-release-sync.service deploy/spacepreview-release-sync.timer /etc/systemd/system/
install -m 600 deploy/downloads.nginx.conf "$EXTENSION/spacepreview-downloads.conf"
/www/server/nginx/sbin/nginx -t
/www/server/nginx/sbin/nginx -s reload
systemctl daemon-reload
systemctl enable --now spacepreview-release-sync.timer
echo "Backup: $BACKUP"
echo 'Installed static mirror and 30-minute timer; existing website files unchanged.'
