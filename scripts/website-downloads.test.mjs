import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import vm from 'node:vm';

const base = 'https://spacepreview.likh.cn/downloads';
const suffixes = ['windows-x64-setup.exe', 'macos-x64.dmg', 'macos-arm64.dmg', 'linux-x64.AppImage', 'linux-x64.deb'];
const platforms = ['windows', 'macos-x64', 'macos-arm64', 'linux', 'linux-deb'];
const fixture = () => ({ tag_name: 'v9.0.0', assets: suffixes.map((suffix) => ({ name: `SpacePreview-9.0.0-${suffix}`, browser_download_url: `${base}/v9.0.0/SpacePreview-9.0.0-${suffix}` })) });

async function website(release, options = {}) {
  const state = {};
  const cards = platforms.slice(0, 4).map((platform) => ({
    selected: false,
    classList: { toggle(_, enabled) { cards[platforms.indexOf(platform)].selected = enabled; } },
    querySelector: () => ({ dataset: { platform } }),
  }));
  const links = platforms.map((platform, index) => ({
    dataset: { platform }, href: `${base}/latest/SpacePreview-${suffixes[index]}`,
    classList: { contains: () => true }, closest: () => ({ querySelector: () => ({}) }),
  }));
  const requests = [];
  const context = vm.createContext({
    window: { SpacePreviewI18n: { t: (key) => key } },
    navigator: { platform: options.platform || 'Win32', userAgentData: options.hints ? { getHighEntropyValues: async () => options.hints } : undefined },
    document: { addEventListener() {}, querySelector: (selector) => state[selector] ||= {}, querySelectorAll: (selector) => selector === '.download-card' ? cards : links },
    fetch: async (url, init) => { requests.push({ url, init }); if (options.networkError) throw Error('offline'); return { ok: true, json: async () => release }; },
    AbortController, setTimeout, clearTimeout,
  });
  vm.runInContext(fs.readFileSync(new URL('../website/script.js', import.meta.url), 'utf8'), context);
  await new Promise(setImmediate);
  return { links, cards, state, requests };
}

describe('official downloads', () => {
  it('checks uncached server metadata and maps all five installers', async () => {
    const page = await website(fixture());
    expect(page.requests[0].url).toBe(`${base}/release.json`);
    expect(page.requests[0].init.cache).toBe('no-store');
    expect(page.links.map((link) => link.href)).toEqual(fixture().assets.map((asset) => asset.browser_download_url));
    expect(page.state['[data-release-state]'].textContent).toBe('ready');
  });
  it('keeps all official fallback links on errors, missing files or foreign URLs', async () => {
    for (const mode of ['offline', 'missing', 'foreign', 'wrong-version']) {
      const release = fixture();
      if (mode === 'missing') release.assets.pop();
      if (mode === 'foreign') release.assets[0].browser_download_url = 'https://github.com/likehao19/SpacePreview/releases/latest';
      if (mode === 'wrong-version') release.tag_name = 'v8.0.0';
      const page = await website(release, { networkError: mode === 'offline' });
      expect(page.links.every((link) => link.href.startsWith(`${base}/latest/`))).toBe(true);
      expect(page.state['[data-release-state]'].textContent).toBe('fallback');
    }
  });
  it('recommends supported OS/architecture without guessing an unknown Mac CPU', async () => {
    for (const [options, expected] of [
      [{ platform: 'Win32' }, [true, false, false, false]],
      [{ hints: { platform: 'macOS', architecture: 'arm' } }, [false, false, true, false]],
      [{ hints: { platform: 'macOS', architecture: 'x86' } }, [false, true, false, false]],
      [{ platform: 'MacIntel' }, [false, true, true, false]],
      [{ platform: 'Linux x86_64' }, [false, false, false, true]],
      [{ platform: 'Linux aarch64' }, [false, false, false, false]],
    ]) expect((await website(fixture(), options)).cards.map((card) => card.selected)).toEqual(expected);
  });
  it('uses server addresses even before JavaScript runs and preserves the updater trust key', () => {
    const html = fs.readFileSync(new URL('../website/index.html', import.meta.url), 'utf8');
    expect([...html.matchAll(/data-platform="[^"]+"\s+href="([^"]+)"/g)].map((match) => match[1])).toEqual(suffixes.map((suffix) => `${base}/latest/SpacePreview-${suffix}`));
    const config = JSON.parse(fs.readFileSync(new URL('../src-tauri/tauri.conf.json', import.meta.url)));
    expect(config.plugins.updater.endpoints).toEqual([`${base}/latest.json`]);
    const mirror = fs.readFileSync(new URL('../deploy/release_mirror.py', import.meta.url), 'utf8');
    expect(mirror).toContain(`PUBLIC_KEY = "${config.plugins.updater.pubkey}"`);
  });
});
