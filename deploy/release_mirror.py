#!/usr/bin/env python3
"""SpacePreview's bounded, single-writer static release publisher (Python stdlib + OpenSSL)."""
import argparse
import base64
import contextlib
import datetime
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import resource
import shutil
import signal
import subprocess
import sys
import tarfile
import tempfile
import urllib.request
import uuid

REPOSITORY = "likehao19/SpacePreview"
PUBLIC_BASE = "https://spacepreview.likh.cn/downloads"
ROOT = Path("/srv/spacepreview-downloads")
# The existing Tauri updater key. Never replace it when rotating SSH deployment keys.
PUBLIC_KEY = "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IEFGMUVGNjk2NEI3QzQ0QwpSV1JNeExka2FlL3hDdXp5S01rWHR2WnBQcmJWaDYyT2dpdktqbktVdXlzYWJyQXhuRDljUjdJbQo="
MAX_FILE = 1024 * 1024 * 1024
MAX_TOTAL = 2 * MAX_FILE
MAX_JSON = 2 * 1024 * 1024
TARGETS = {"windows-x86_64": "windows-x64-setup.exe",
           "darwin-x86_64": "macos-x64.app.tar.gz",
           "darwin-aarch64": "macos-arm64.app.tar.gz", "linux-x86_64": "linux-x64.AppImage"}
INSTALLERS = ["windows-x64-setup.exe", "macos-x64.dmg", "macos-arm64.dmg",
              "linux-x64.AppImage", "linux-x64.deb"]


def version(tag):
    if not isinstance(tag, str) or not re.fullmatch(r"v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)", tag):
        raise ValueError("Not a stable release tag")
    return tuple(map(int, tag[1:].split(".")))


def asset_names(tag):
    version(tag)
    packages = {f"SpacePreview-{tag[1:]}-{suffix}" for suffix in INSTALLERS + list(TARGETS.values())}
    signed = {f"SpacePreview-{tag[1:]}-{suffix}.sig" for suffix in TARGETS.values()}
    return packages | signed | {"latest.json", "SHA256SUMS.txt"}


def write_json(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def fetch(url, destination=None, limit=MAX_JSON, expected=None):
    request = urllib.request.Request(url, headers={"User-Agent": "SpacePreview-release-mirror/1",
                                                 "Accept": "application/vnd.github+json"})
    with urllib.request.urlopen(request, timeout=30) as response:
        if not response.url.startswith("https://"):
            raise ValueError("HTTPS required")
        count, chunks = 0, []
        with destination.open("xb") if destination else contextlib.nullcontext() as output:
            while chunk := response.read(64 * 1024):
                count += len(chunk)
                if count > limit:
                    raise ValueError("Download exceeds limit")
                if output:
                    output.write(chunk)
                else:
                    chunks.append(chunk)
            if output:
                output.flush()
                os.fsync(output.fileno())
        if expected is not None and count != expected:
            raise ValueError("Truncated or unexpected download size")
        if not destination:
            return json.loads(b"".join(chunks))


def release_assets(release):
    tag = release.get("tag_name")
    version(tag)
    if release.get("draft") is not False or release.get("prerelease") is not False or not release.get("published_at"):
        raise ValueError("Release is not published and stable")
    entries = release["assets"]
    assets = {entry["name"]: entry for entry in entries}
    if len(assets) != len(entries) or not asset_names(tag) <= assets.keys():
        raise ValueError("Incomplete or duplicate release assets")
    total = 0
    for name in asset_names(tag):
        entry = assets[name]
        size = entry["size"]
        if type(size) is not int or not 0 < size <= (MAX_JSON if name in {"latest.json", "SHA256SUMS.txt"} or name.endswith(".sig") else MAX_FILE):
            raise ValueError("Invalid asset size")
        total += size
        if entry["browser_download_url"] != f"https://github.com/{REPOSITORY}/releases/download/{tag}/{name}":
            raise ValueError("Unexpected source asset URL")
    if total > MAX_TOTAL:
        raise ValueError("Release exceeds disk budget")
    return tag, {name: assets[name] for name in asset_names(tag)}


def verify_signature(path, encoded, public_key, prehash):
    """Verify both Minisign signatures, without loading the update package into memory."""
    key = base64.b64decode(base64.b64decode(public_key).decode().splitlines()[1], validate=True)
    lines = base64.b64decode(encoded, validate=True).decode().splitlines()
    if len(key) != 42 or key[:2] != b"Ed" or len(lines) != 4 or not lines[0].startswith("untrusted comment: ") or not lines[2].startswith("trusted comment: "):
        raise ValueError("Invalid Minisign encoding")
    sig = base64.b64decode(lines[1], validate=True)
    global_sig = base64.b64decode(lines[3], validate=True)
    if len(sig) != 74 or sig[:2] not in (b"ED", b"Ed") or sig[2:10] != key[2:10] or len(global_sig) != 64:
        raise ValueError("Signature key or algorithm mismatch")
    with tempfile.TemporaryDirectory(prefix="signature-", dir=path.parent.parent) as temporary:
        temporary = Path(temporary)
        key_file = temporary / "key.der"
        key_file.write_bytes(bytes.fromhex("302a300506032b6570032100") + key[10:])
        for signature, message in [(global_sig, sig[10:] + lines[2][17:].strip().encode()),
                                   (sig[10:], prehash if sig[:2] == b"ED" else None)]:
            signature_file, message_file = temporary / "signature", temporary / "message"
            signature_file.write_bytes(signature)
            if message is not None:
                message_file.write_bytes(message)
            # OpenSSL maps legacy input; limit its size to protect server memory.
            elif path.stat().st_size > 32 * 1024 * 1024:
                raise ValueError("Large legacy signature requires prehashed Minisign format")
            result = subprocess.run(["openssl", "pkeyutl", "-verify", "-pubin", "-keyform", "DER",
                                     "-inkey", str(key_file), "-rawin", "-in", str(message_file if message is not None else path),
                                     "-sigfile", str(signature_file)], capture_output=True, timeout=30)
            if result.returncode:
                raise ValueError("Update signature verification failed")


def validate(directory, release, public_key=PUBLIC_KEY):
    tag, assets = release_assets(release)
    if {entry.name for entry in directory.iterdir()} != set(assets):
        raise ValueError("Missing or extra upload files")
    checks = {}
    for line in (directory / "SHA256SUMS.txt").read_text().splitlines():
        match = re.fullmatch(r"([a-f0-9]{64})  ([A-Za-z0-9._-]+)", line)
        if not match or match[2] in checks:
            raise ValueError("Invalid checksum list")
        checks[match[2]] = match[1]
    if checks.keys() != assets.keys() - {"SHA256SUMS.txt"}:
        raise ValueError("Incomplete checksum list")
    hashes = {}
    for name, entry in assets.items():
        path = directory / name
        if not path.is_file() or path.is_symlink() or path.stat().st_size != entry["size"]:
            raise ValueError(f"Size/type mismatch: {name}")
        sha, prehash = hashlib.sha256(), hashlib.blake2b()
        with path.open("rb") as source:
            while chunk := source.read(256 * 1024):
                sha.update(chunk)
                prehash.update(chunk)
        digest = sha.hexdigest()
        if name in checks and digest != checks[name]:
            raise ValueError(f"SHA-256 mismatch: {name}")
        if entry.get("digest") and entry["digest"] != "sha256:" + digest:
            raise ValueError(f"GitHub digest mismatch: {name}")
        hashes[name] = prehash.digest()
    manifest = json.loads((directory / "latest.json").read_text())
    if manifest["version"] != tag[1:] or set(manifest["platforms"]) != set(TARGETS) or not isinstance(manifest.get("notes"), str):
        raise ValueError("Manifest version/platform mismatch")
    datetime.datetime.fromisoformat(manifest["pub_date"].replace("Z", "+00:00"))
    for target, suffix in TARGETS.items():
        name = f"SpacePreview-{tag[1:]}-{suffix}"
        item = manifest["platforms"][target]
        if item["url"] not in (f"https://github.com/{REPOSITORY}/releases/download/{tag}/{name}", f"{PUBLIC_BASE}/{tag}/{name}"):
            raise ValueError("Manifest URL/file mismatch")
        signature = (directory / (name + ".sig")).read_text().strip()
        if item["signature"] != signature:
            raise ValueError("Manifest signature mismatch")
        verify_signature(directory / name, signature, public_key, hashes[name])
    return manifest


class Mirror:
    def __init__(self, root=ROOT, public_key=PUBLIC_KEY):
        self.root, self.public_key = Path(root), public_key
        self.staging, self.releases = self.root / "staging", self.root / "releases"

    @contextlib.contextmanager
    def locked(self):
        self.staging.mkdir(parents=True, exist_ok=True, mode=0o700)
        self.releases.mkdir(exist_ok=True)
        with (self.root / "sync.lock").open("a") as lock:
            try:
                fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError:
                raise RuntimeError("Another release sync holds the lock")
            self.recover()
            yield

    def current_tag(self):
        current = self.root / "current"
        if not current.is_symlink():
            if current.exists():
                raise ValueError("Unexpected current entry")
            return None
        target = current.resolve(strict=True)
        if target.parent != self.releases.resolve():
            raise ValueError("Unexpected current target")
        version(target.name)
        return target.name

    def recover(self):
        current = self.current_tag()
        for directory in [self.staging, self.releases]:
            for entry in directory.iterdir():
                if directory == self.releases and entry.name == current:
                    continue
                if entry.is_symlink() or not entry.is_dir():
                    entry.unlink()
                else:
                    shutil.rmtree(entry)
        for link in self.root.glob(".current-*"):
            link.unlink()

    def newer(self, tag):
        current = self.current_tag()
        return current is None or version(tag) > version(current)

    def publish(self, stage, release):
        tag, assets = release_assets(release)
        if not self.newer(tag):
            print(f"Skipped {tag}: current release is equal or newer", flush=True)
            return False
        source = stage / "source"
        manifest = validate(source, release, self.public_key)
        public = stage / "public"
        public.mkdir()
        packages = public / tag
        source.rename(packages)
        for target, suffix in TARGETS.items():
            manifest["platforms"][target]["url"] = f"{PUBLIC_BASE}/{tag}/SpacePreview-{tag[1:]}-{suffix}"
        write_json(packages / "latest.json", manifest)
        # Recalculate the public checksum list after rewriting legacy GitHub URLs.
        checks = {line.split("  ")[1]: line.split("  ")[0]
                  for line in (packages / "SHA256SUMS.txt").read_text().splitlines()}
        checks["latest.json"] = hashlib.sha256((packages / "latest.json").read_bytes()).hexdigest()
        (packages / "SHA256SUMS.txt").write_text("".join(f"{checks[name]}  {name}\n" for name in sorted(checks)))
        write_json(public / "release.json", {
            "tag_name": tag, "version": tag[1:], "body": manifest["notes"],
            "published_at": release["published_at"],
            "html_url": f"https://spacepreview.likh.cn/#download",
            "assets": [{"name": name, "size": (packages / name).stat().st_size,
                        "browser_download_url": f"{PUBLIC_BASE}/{tag}/{name}"} for name in sorted(assets)]})
        (public / "latest.json").symlink_to(f"{tag}/latest.json")
        (public / "SHA256SUMS.txt").symlink_to(f"{tag}/SHA256SUMS.txt")
        (public / "latest").mkdir()
        for suffix in INSTALLERS:
            (public / "latest" / f"SpacePreview-{suffix}").symlink_to(f"../{tag}/SpacePreview-{tag[1:]}-{suffix}")
        for entry in public.rglob("*"):
            if not entry.is_symlink():
                entry.chmod(0o755 if entry.is_dir() else 0o644)
        public.chmod(0o755)
        # Files and directory entries become durable before the one atomic pointer swap.
        for entry in public.rglob("*"):
            if entry.is_file() and not entry.is_symlink():
                with entry.open("rb") as file:
                    os.fsync(file.fileno())
        for directory in [packages, public / "latest", public]:
            fd = os.open(directory, os.O_RDONLY)
            try:
                os.fsync(fd)
            finally:
                os.close(fd)
        public.rename(self.releases / tag)
        fd = os.open(self.releases, os.O_RDONLY)
        try:
            os.fsync(fd)
        finally:
            os.close(fd)
        link = self.root / (".current-" + uuid.uuid4().hex)
        link.symlink_to(f"releases/{tag}")
        os.replace(link, self.root / "current")
        fd = os.open(self.root, os.O_RDONLY)
        try:
            os.fsync(fd)
        finally:
            os.close(fd)
        self.recover()
        print(f"Published {tag}: verified all platforms; old packages removed", flush=True)
        return True

    def sync(self):
        with self.locked():
            release = fetch(f"https://api.github.com/repos/{REPOSITORY}/releases/latest")
            tag, assets = release_assets(release)
            if not self.newer(tag):
                print(f"Skipped {tag}: already synchronized or older", flush=True)
                return False
            with tempfile.TemporaryDirectory(prefix="pull-", dir=self.staging) as stage:
                stage = Path(stage)
                source = stage / "source"
                source.mkdir()
                for name, entry in sorted(assets.items()):
                    print(f"Downloading {name} ({entry['size']} bytes)", flush=True)
                    fetch(entry["browser_download_url"], source / name, entry["size"], entry["size"])
                return self.publish(stage, release)

    def receive(self, stream, tag):
        version(tag)
        with self.locked():
            with tempfile.TemporaryDirectory(prefix="push-", dir=self.staging) as temporary:
                stage = Path(temporary)
                source = stage / "source"
                source.mkdir()
                allowed = asset_names(tag) | {"_release.json"}
                seen, total = set(), 0
                with tarfile.open(fileobj=stream, mode="r|") as archive:
                    for member in archive:
                        if member.name not in allowed or member.name in seen or not member.isfile() or member.size <= 0:
                            raise ValueError("Unsafe or duplicate upload member")
                        limit = MAX_JSON if member.name.endswith((".json", ".sig", ".txt")) else MAX_FILE
                        total += member.size
                        if member.size > limit or total > MAX_TOTAL:
                            raise ValueError("Upload exceeds limit")
                        seen.add(member.name)
                        with archive.extractfile(member) as incoming, (source / member.name).open("xb") as output:
                            shutil.copyfileobj(incoming, output, 64 * 1024)
                # Consume tar padding so a successful duplicate does not break the upload pipe.
                remaining = stream.read(1024 * 1024 + 1)
                if len(remaining) > 1024 * 1024 or remaining.strip(b"\0") or seen != allowed:
                    raise ValueError("Incomplete or invalid upload")
                release = json.loads((source / "_release.json").read_text())
                (source / "_release.json").unlink()
                if release.get("tag_name") != tag:
                    raise ValueError("Upload tag mismatch")
                return self.publish(stage, release)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["sync", "receive"], nargs="?")
    parser.add_argument("tag", nargs="?")
    parser.add_argument("--ssh", action="store_true")
    args = parser.parse_args()
    if args.ssh:
        match = re.fullmatch(r"receive (v\d+\.\d+\.\d+)", os.environ.get("SSH_ORIGINAL_COMMAND", ""))
        if not match:
            parser.error("Only signed release uploads are permitted")
        args.command, args.tag = "receive", match[1]
    os.umask(0o077)
    os.nice(10)
    resource.setrlimit(resource.RLIMIT_AS, (256 * 1024 * 1024,) * 2)
    resource.setrlimit(resource.RLIMIT_CPU, (180, 180))
    resource.setrlimit(resource.RLIMIT_FSIZE, (MAX_FILE,) * 2)
    signal.signal(signal.SIGTERM, lambda *_: sys.exit("Sync terminated"))
    signal.signal(signal.SIGALRM, lambda *_: sys.exit("Sync timeout"))
    signal.alarm(1800)
    try:
        if args.command == "sync":
            Mirror().sync()
        elif args.command == "receive" and args.tag:
            Mirror().receive(sys.stdin.buffer, args.tag)
        else:
            parser.error("Specify sync or receive TAG")
    except Exception as error:
        print(f"Sync failed: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
