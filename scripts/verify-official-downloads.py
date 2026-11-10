#!/usr/bin/env python3
"""Download official production assets through public HTTPS and verify bytes/signatures."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'deploy'))
from release_mirror import PUBLIC_BASE, PUBLIC_KEY, REPOSITORY, TARGETS, asset_names, verify_signature


def curl(url, destination, headers=None, head=False):
    args = ['curl', '--silent', '--show-error', '--fail', '--location', '--max-time', '600',
            '--proto', '=https', '--proto-redir', '=https', '--output', str(destination)]
    if headers: args += ['--dump-header', str(headers)]
    if head: args.append('--head')
    subprocess.run(args + [url], check=True)


with tempfile.TemporaryDirectory(prefix='spacepreview-public-qa-') as temporary:
    root = Path(temporary)
    for name in ['release.json', 'latest.json', 'SHA256SUMS.txt']:
        headers = root / (name + '.headers')
        curl(f'{PUBLIC_BASE}/{name}', root / name, headers)
        assert 'cache-control: no-store' in headers.read_text().lower()
    release = json.loads((root / 'release.json').read_text())
    tag = release['tag_name']
    names = asset_names(tag)
    manifest = json.loads((root / 'latest.json').read_text())
    assert manifest['version'] == tag[1:] and set(manifest['platforms']) == set(TARGETS)
    checks = dict((line.split('  ')[1], line.split('  ')[0]) for line in (root / 'SHA256SUMS.txt').read_text().splitlines())
    assert set(checks) == names - {'SHA256SUMS.txt'}
    curl(f'https://api.github.com/repos/{REPOSITORY}/releases/tags/{tag}', root / 'github.json')
    github = json.loads((root / 'github.json').read_text())
    assert not github['draft'] and not github['prerelease']
    original = {entry['name']: entry for entry in github['assets']}
    for name in sorted(names):
        if name in ['latest.json', 'SHA256SUMS.txt']: continue
        curl(f'{PUBLIC_BASE}/{tag}/{name}', root / name)
    for name in sorted(checks):
        path = root / name
        sha, prehash = hashlib.sha256(), hashlib.blake2b()
        with path.open('rb') as source:
            while chunk := source.read(256 * 1024):
                sha.update(chunk)
                prehash.update(chunk)
        assert sha.hexdigest() == checks[name], name
        if name != 'latest.json':
            assert path.stat().st_size == original[name]['size'], name
            assert 'sha256:' + sha.hexdigest() == original[name]['digest'], name
        for target, suffix in TARGETS.items():
            if name == f'SpacePreview-{tag[1:]}-{suffix}':
                item = manifest['platforms'][target]
                assert item['url'] == f'{PUBLIC_BASE}/{tag}/{name}'
                assert item['signature'] == (root / (name + '.sig')).read_text().strip()
                verify_signature(path, item['signature'], PUBLIC_KEY, prehash.digest())
        print(f'OK {name}: {path.stat().st_size} bytes, SHA-256 verified', flush=True)
    for suffix in ['windows-x64-setup.exe', 'macos-x64.dmg', 'macos-arm64.dmg', 'linux-x64.AppImage', 'linux-x64.deb']:
        headers = root / 'fallback.headers'
        curl(f'{PUBLIC_BASE}/latest/SpacePreview-{suffix}', headers, head=True)
        body = headers.read_text().lower()
        assert 'cache-control: no-store' in body and 'accept-ranges: bytes' in body
    print(f'Public HTTPS validation passed for {tag}: all installers, update packages, hashes, four pinned-key signatures and five fallback links. Temporary downloads removed on exit.')
