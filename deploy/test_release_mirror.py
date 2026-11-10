import base64
import copy
import hashlib
import io
import json
import multiprocessing
from pathlib import Path
import shutil
import subprocess
import tarfile
import tempfile
import unittest
from unittest.mock import patch

import release_mirror as mirror


class ReleaseTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.keys = tempfile.TemporaryDirectory()
        cls.key = Path(cls.keys.name) / 'key.pem'
        subprocess.run(['openssl', 'genpkey', '-algorithm', 'Ed25519', '-out', str(cls.key)], check=True, capture_output=True)
        public = subprocess.check_output(['openssl', 'pkey', '-in', str(cls.key), '-pubout', '-outform', 'DER'])[-32:]
        cls.key_id = b'test-key'
        cls.public_key = base64.b64encode(b'untrusted comment: test\n' + base64.b64encode(b'Ed' + cls.key_id + public) + b'\n').decode()

    @classmethod
    def tearDownClass(cls):
        cls.keys.cleanup()

    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name) / 'mirror'
        self.store = mirror.Mirror(self.root, self.public_key)

    def signature(self, payload):
        message = Path(self.temporary.name) / 'message'
        def sign(data):
            message.write_bytes(data)
            return subprocess.check_output(['openssl', 'pkeyutl', '-sign', '-rawin', '-inkey', str(self.key), '-in', str(message)])
        sig = sign(hashlib.blake2b(payload).digest())
        text = b'untrusted comment: test\n' + base64.b64encode(b'ED' + self.key_id + sig)
        text += b'\ntrusted comment: test\n' + base64.b64encode(sign(sig + b'test')) + b'\n'
        return base64.b64encode(text).decode()

    def fixture(self, tag='v1.0.0'):
        directory = Path(self.temporary.name) / (tag + '-' + next(tempfile._get_candidate_names()))
        directory.mkdir()
        for name in mirror.asset_names(tag) - {'latest.json', 'SHA256SUMS.txt'}:
            if not name.endswith('.sig'):
                (directory / name).write_bytes((name + '\n').encode() * 20)
        platforms = {}
        for target, suffix in mirror.TARGETS.items():
            name = f'SpacePreview-{tag[1:]}-{suffix}'
            signature = self.signature((directory / name).read_bytes())
            (directory / (name + '.sig')).write_text(signature + '\n')
            platforms[target] = {'signature': signature, 'url': f'https://github.com/{mirror.REPOSITORY}/releases/download/{tag}/{name}'}
        mirror.write_json(directory / 'latest.json', {'version': tag[1:], 'notes': '测试更新', 'pub_date': '2026-11-10T00:00:00Z', 'platforms': platforms})
        release = {'tag_name': tag, 'draft': False, 'prerelease': False, 'published_at': '2026-11-10T00:00:00Z'}
        self.checks(directory, release)
        return directory, release

    def checks(self, directory, release):
        tag = release['tag_name']
        (directory / 'SHA256SUMS.txt').write_text(''.join(f'{hashlib.sha256((directory / name).read_bytes()).hexdigest()}  {name}\n' for name in sorted(mirror.asset_names(tag) - {'SHA256SUMS.txt'})))
        release['assets'] = [{'name': name, 'size': (directory / name).stat().st_size,
                              'digest': 'sha256:' + hashlib.sha256((directory / name).read_bytes()).hexdigest(),
                              'browser_download_url': f'https://github.com/{mirror.REPOSITORY}/releases/download/{tag}/{name}'} for name in sorted(mirror.asset_names(tag))]

    def upload(self, directory, release):
        stream = io.BytesIO()
        with tarfile.open(fileobj=stream, mode='w') as archive:
            for path in directory.iterdir():
                archive.add(path, arcname=path.name)
            data = json.dumps(release).encode()
            entry = tarfile.TarInfo('_release.json')
            entry.size = len(data)
            archive.addfile(entry, io.BytesIO(data))
        stream.seek(0)
        return self.store.receive(stream, release['tag_name'])

    def test_complete_atomic_publication_and_server_urls(self):
        self.assertTrue(self.upload(*self.fixture()))
        current = self.root / 'current'
        manifest = json.loads((current / 'latest.json').read_text())
        for item in manifest['platforms'].values():
            self.assertTrue(item['url'].startswith(mirror.PUBLIC_BASE + '/v1.0.0/'))
        self.assertEqual(len(list((current / 'latest').iterdir())), 5)
        self.assertEqual(list((self.root / 'staging').iterdir()), [])

    def test_missing_file_and_size_mismatch(self):
        for mode in ['missing', 'size']:
            directory, release = self.fixture()
            name = 'SpacePreview-1.0.0-macos-x64.dmg'
            if mode == 'missing': (directory / name).unlink()
            else: (directory / name).write_bytes(b'bad')
            with self.assertRaises(ValueError): self.upload(directory, release)
            self.assertFalse((self.root / 'current').exists())
            self.assertEqual(list((self.root / 'staging').iterdir()), [])

    def test_corruption_even_with_matching_size(self):
        directory, release = self.fixture()
        path = directory / 'SpacePreview-1.0.0-linux-x64.AppImage'
        path.write_bytes(b'x' * path.stat().st_size)
        with self.assertRaisesRegex(ValueError, 'SHA-256'): self.upload(directory, release)

    def test_signature_checks_payload_even_when_checksums_replaced(self):
        directory, release = self.fixture()
        path = directory / 'SpacePreview-1.0.0-linux-x64.AppImage'
        path.write_bytes(b'forged package')
        self.checks(directory, release)
        with self.assertRaisesRegex(ValueError, 'signature verification'): self.upload(directory, release)

    def test_signature_manifest_mismatch(self):
        directory, release = self.fixture()
        path = directory / 'latest.json'
        manifest = json.loads(path.read_text())
        manifest['platforms']['linux-x86_64']['signature'] = 'invalid'
        mirror.write_json(path, manifest)
        self.checks(directory, release)
        with self.assertRaisesRegex(ValueError, 'Manifest signature'): self.upload(directory, release)

    def test_wrong_platform_url(self):
        directory, release = self.fixture()
        path = directory / 'latest.json'
        manifest = json.loads(path.read_text())
        manifest['platforms']['linux-x86_64']['url'] = 'https://example.com/wrong'
        mirror.write_json(path, manifest)
        self.checks(directory, release)
        with self.assertRaisesRegex(ValueError, 'URL/file'): self.upload(directory, release)

    def test_untrusted_key(self):
        directory, release = self.fixture()
        original = mirror.base64.b64decode(self.public_key).decode().splitlines()[1]
        raw = bytearray(base64.b64decode(original))
        raw[-1] ^= 1
        self.store.public_key = base64.b64encode(b'untrusted comment: test\n' + base64.b64encode(raw)).decode()
        with self.assertRaisesRegex(ValueError, 'signature verification'): self.upload(directory, release)

    def test_drafts_prereleases_incomplete_and_foreign_sources(self):
        directory, original = self.fixture()
        for mode in ['draft', 'prerelease', 'missing', 'url', 'duplicate']:
            release = copy.deepcopy(original)
            if mode in ['draft', 'prerelease']: release[mode] = True
            if mode == 'missing': release['assets'].pop()
            if mode == 'url': release['assets'][0]['browser_download_url'] = 'https://evil.invalid/file'
            if mode == 'duplicate': release['assets'].append(release['assets'][0])
            with self.assertRaises(ValueError): self.upload(directory, release)

    def test_duplicates_late_tasks_and_no_downgrades(self):
        old = self.fixture('v1.0.0')
        latest = self.fixture('v1.1.0')
        self.assertTrue(self.upload(*latest))
        target = (self.root / 'current').readlink()
        self.assertFalse(self.upload(*latest))
        self.assertFalse(self.upload(*old))
        self.assertEqual((self.root / 'current').readlink(), target)
        self.assertEqual([p.name for p in self.store.releases.iterdir()], ['v1.1.0'])

    def test_old_packages_removed_only_after_success(self):
        self.upload(*self.fixture())
        directory, release = self.fixture('v1.1.0')
        (directory / 'SpacePreview-1.1.0-macos-x64.dmg').write_bytes(b'broken')
        with self.assertRaises(ValueError): self.upload(directory, release)
        self.assertEqual(self.store.current_tag(), 'v1.0.0')
        self.assertTrue((self.root / 'current/v1.0.0/latest.json').is_file())
        self.upload(*self.fixture('v1.2.0'))
        self.assertFalse((self.store.releases / 'v1.0.0').exists())

    def test_interruption_before_swap_preserves_old_and_recovers(self):
        self.upload(*self.fixture())
        with patch.object(mirror.os, 'replace', side_effect=OSError('interrupted')):
            with self.assertRaises(OSError): self.upload(*self.fixture('v1.1.0'))
        self.assertEqual(self.store.current_tag(), 'v1.0.0')
        with self.store.locked(): pass
        self.assertEqual([p.name for p in self.store.releases.iterdir()], ['v1.0.0'])
        self.assertEqual(list(self.root.glob('.current-*')), [])

    def test_interruption_after_swap_recovers_old_and_staging(self):
        self.upload(*self.fixture())
        (self.store.releases / 'v0.9.0').mkdir()
        (self.store.staging / 'abandoned').mkdir()
        with self.store.locked(): pass
        self.assertEqual([p.name for p in self.store.releases.iterdir()], ['v1.0.0'])
        self.assertEqual(list(self.store.staging.iterdir()), [])

    def test_concurrent_push_pull_use_one_cross_process_lock(self):
        with self.store.locked():
            ctx = multiprocessing.get_context('fork')
            output = ctx.Queue()
            def competing():
                try:
                    with mirror.Mirror(self.root).locked(): output.put('acquired')
                except RuntimeError: output.put('locked')
            process = ctx.Process(target=competing)
            process.start()
            self.assertEqual(output.get(timeout=5), 'locked')
            process.join(5)
            self.assertFalse(process.is_alive())

    def test_partial_upload_and_path_traversal_leave_nothing_public(self):
        for name, kind in [('../outside', tarfile.REGTYPE), ('latest.json', tarfile.SYMTYPE)]:
            data = io.BytesIO()
            with tarfile.open(fileobj=data, mode='w') as archive:
                entry = tarfile.TarInfo(name)
                entry.type, entry.size = kind, 1
                archive.addfile(entry, io.BytesIO(b'x'))
            data.seek(0)
            with self.assertRaises(ValueError): self.store.receive(data, 'v1.0.0')
        with self.assertRaises((ValueError, tarfile.TarError)): self.store.receive(io.BytesIO(b'broken'), 'v1.0.0')
        self.assertFalse((self.root / 'current').exists())
        self.assertEqual(list(self.store.staging.iterdir()), [])

    def test_timer_pull_recovers_failed_upload_and_skips_duplicate(self):
        directory, release = self.fixture()
        def download(url, destination=None, *args):
            if destination is None: return release
            shutil.copyfile(directory / url.rsplit('/', 1)[1], destination)
        with patch.object(mirror, 'fetch', side_effect=download):
            self.assertTrue(self.store.sync())
            self.assertFalse(self.store.sync())

    def test_failed_pull_leaves_current_and_cleans_staging(self):
        self.upload(*self.fixture())
        _, release = self.fixture('v1.1.0')
        def interrupted(url, destination=None, *args):
            if destination is None: return release
            destination.write_bytes(b'partial')
            raise OSError('network disconnected')
        with patch.object(mirror, 'fetch', side_effect=interrupted):
            with self.assertRaises(OSError): self.store.sync()
        self.assertEqual(self.store.current_tag(), 'v1.0.0')
        self.assertEqual(list(self.store.staging.iterdir()), [])

    def test_numeric_version_order(self):
        self.assertGreater(mirror.version('v0.10.23'), mirror.version('v0.9.99'))
        for tag in ['v1.0.0-beta.1', 'v01.0.0', '../v1.0.0']:
            with self.assertRaises(ValueError): mirror.version(tag)


if __name__ == '__main__':
    unittest.main()
