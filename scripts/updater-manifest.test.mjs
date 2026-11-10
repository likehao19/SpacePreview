import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createUpdateManifest, updateAssetName, updateTargets } from './updater-manifest.mjs';

const temporary = [];
const signature = Buffer.from(
  'untrusted comment: test\nsignature\ntrusted comment: test\nsignature',
).toString('base64');
function fixtures() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'spacepreview-updater-'));
  temporary.push(directory);
  for (const platform of Object.keys(updateTargets)) {
    const name = updateAssetName('0.11.0', platform);
    fs.writeFileSync(path.join(directory, name), 'test artifact');
    fs.writeFileSync(path.join(directory, `${name}.sig`), `${signature}\n`);
  }
  return directory;
}
afterEach(() => {
  for (const directory of temporary.splice(0)) fs.rmSync(directory, { recursive: true });
});

describe('signed release manifest', () => {
  it('maps all four architectures to versioned update assets', () => {
    const manifest = createUpdateManifest(
      fixtures(),
      '0.11.0',
      'likehao19/SpacePreview',
      '中文更新',
      new Date('2026-10-16T00:00:00Z'),
    );
    expect(manifest.version).toBe('0.11.0');
    expect(manifest.notes).toBe('中文更新');
    expect(manifest.pub_date).toBe('2026-10-16T00:00:00.000Z');
    expect(Object.keys(manifest.platforms)).toEqual([
      'windows-x86_64',
      'darwin-x86_64',
      'darwin-aarch64',
      'linux-x86_64',
    ]);
    for (const [platform, target] of Object.entries(updateTargets)) {
      expect(manifest.platforms[target]).toEqual({
        signature,
        url: `https://spacepreview.likh.cn/downloads/v0.11.0/${updateAssetName('0.11.0', platform)}`,
      });
    }
    expect(manifest.platforms['linux-x86_64'].url).toMatch(/linux-x64\.AppImage$/);
  });
  it('rejects missing, empty or unsigned artifacts before publishing', () => {
    for (const platform of Object.keys(updateTargets)) {
      for (const failure of ['missing', 'empty', 'unsigned', 'invalid']) {
        const directory = fixtures();
        const artifact = path.join(directory, updateAssetName('0.11.0', platform));
        if (failure === 'missing') fs.unlinkSync(artifact);
        if (failure === 'empty') fs.writeFileSync(artifact, '');
        if (failure === 'unsigned') fs.unlinkSync(`${artifact}.sig`);
        if (failure === 'invalid') fs.writeFileSync(`${artifact}.sig`, '');
        expect(() =>
          createUpdateManifest(directory, '0.11.0', 'likehao19/SpacePreview', ''),
        ).toThrow();
      }
    }
  });
  it('rejects prereleases, malformed versions and repository paths', () => {
    for (const version of ['0.11.0-beta.1', '../0.11.0', 'v0.11.0'])
      expect(() =>
        createUpdateManifest(fixtures(), version, 'likehao19/SpacePreview', ''),
      ).toThrow();
    expect(() => createUpdateManifest(fixtures(), '0.11.0', '../other/repo', '')).toThrow();
  });
});
