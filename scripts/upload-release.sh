#!/usr/bin/env bash
set -euo pipefail

# Run only after all platform assets and SHA256SUMS.txt have been published.
# Secrets are environment variables, never command arguments or log output.
: "${SPACEPREVIEW_DEPLOY_HOST:?Missing deployment host}"
: "${SPACEPREVIEW_DEPLOY_KEY:?Missing dedicated deployment key}"
: "${SPACEPREVIEW_DEPLOY_KNOWN_HOSTS:?Missing pinned SSH host keys}"
VERSION=$(node -p "require('./package.json').version")
TAG="v$VERSION"
test "${GITHUB_REF_NAME:-$TAG}" = "$TAG"
UPLOAD_TEMP=$(mktemp -d)
trap 'rm -rf "$UPLOAD_TEMP"' EXIT
umask 077
printf '%s\n' "$SPACEPREVIEW_DEPLOY_KEY" > "$UPLOAD_TEMP/key"
printf '%s\n' "$SPACEPREVIEW_DEPLOY_KNOWN_HOSTS" > "$UPLOAD_TEMP/known_hosts"
unset SPACEPREVIEW_DEPLOY_KEY SPACEPREVIEW_DEPLOY_KNOWN_HOSTS
gh api "repos/likehao19/SpacePreview/releases/tags/$TAG" > release-assets/_release.json
trap 'rm -rf "$UPLOAD_TEMP"; rm -f release-assets/_release.json' EXIT
python3 - "$TAG" > "$UPLOAD_TEMP/files" <<'PY'
import sys
from pathlib import Path
sys.path.insert(0, 'deploy')
from release_mirror import release_assets
import json
tag, assets = release_assets(json.loads(Path('release-assets/_release.json').read_text()))
assert tag == sys.argv[1]
print('\n'.join(sorted(set(assets) | {'_release.json'})))
PY
ssh_options=(-i "$UPLOAD_TEMP/key" -o IdentitiesOnly=yes -o BatchMode=yes
  -o StrictHostKeyChecking=yes -o "UserKnownHostsFile=$UPLOAD_TEMP/known_hosts"
  -o ConnectTimeout=20 -o ServerAliveInterval=15 -o ServerAliveCountMax=3)
# A busy shared lock or interrupted transfer is safe to retry; the receiver refuses downgrades.
for attempt in 1 2 3; do
  if tar --format=ustar -C release-assets -cf - -T "$UPLOAD_TEMP/files" |
    timeout 1800 ssh "${ssh_options[@]}" "spacepreview-deploy@$SPACEPREVIEW_DEPLOY_HOST" "receive $TAG"; then
    exit 0
  fi
  if [ "$attempt" -lt 3 ]; then sleep 20; fi
done
echo 'Official mirror upload failed; the server timer will recover from GitHub.' >&2
exit 1
