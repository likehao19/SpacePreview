import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const updateTargets = {
  'windows-x64': 'windows-x86_64',
  'macos-x64': 'darwin-x86_64',
  'macos-arm64': 'darwin-aarch64',
  'linux-x64': 'linux-x86_64',
};

export function updateAssetName(version, platform) {
  if (!updateTargets[platform]) throw new Error(`Unsupported update platform: ${platform}`);
  return `SpacePreview-${version}-${platform}${platform === 'windows-x64' ? '-setup.exe' : platform === 'linux-x64' ? '.AppImage' : '.app.tar.gz'}`;
}

/** Publish only a complete set: a partial manifest would strand one architecture. */
export function createUpdateManifest(directory, version, repository, notes, date = new Date()) {
  if (!/^\d+\.\d+\.\d+$/.test(version))
    throw new Error('Updater releases require a stable version.');
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository)) throw new Error('Invalid GitHub repository.');
  const platforms = {};
  for (const [platform, target] of Object.entries(updateTargets)) {
    const name = updateAssetName(version, platform);
    if (!fs.statSync(path.join(directory, name)).size)
      throw new Error(`Empty update artifact: ${name}`);
    const signature = fs.readFileSync(path.join(directory, `${name}.sig`), 'utf8').trim();
    const decoded = Buffer.from(signature, 'base64').toString('utf8');
    if (!decoded.startsWith('untrusted comment:') || !decoded.includes('trusted comment:'))
      throw new Error(`Invalid update signature: ${name}.sig`);
    platforms[target] = {
      signature,
      url: `https://spacepreview.likh.cn/downloads/v${version}/${name}`,
    };
  }
  return { version, notes, pub_date: date.toISOString(), platforms };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const version = JSON.parse(fs.readFileSync('package.json', 'utf8')).version;
  const manifest = createUpdateManifest(
    'release-assets',
    version,
    process.env.GITHUB_REPOSITORY || 'likehao19/SpacePreview',
    fs.readFileSync('RELEASE-NOTES.md', 'utf8'),
  );
  fs.writeFileSync('release-assets/latest.json', JSON.stringify(manifest, null, 2) + '\n');
  console.log(`Update manifest verified for ${Object.keys(manifest.platforms).join(', ')}`);
}
