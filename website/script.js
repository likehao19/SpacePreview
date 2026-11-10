const downloadBase = 'https://spacepreview.likh.cn/downloads';
const releaseApi = `${downloadBase}/release.json`;
const packagePatterns = {
  windows: /-windows-x64-setup\.exe$/i,
  'macos-x64': /-macos-x64\.dmg$/i,
  'macos-arm64': /-macos-arm64\.dmg$/i,
  linux: /-linux-x64\.AppImage$/i,
  'linux-deb': /-linux-x64\.deb$/i,
};
const translateRelease = window.SpacePreviewI18n.t;
let releaseStatus = 'checking';
let releaseVersion = '';

function renderReleaseState() {
  document.querySelector('[data-release-state]').textContent = translateRelease(releaseStatus, {
    version: releaseVersion,
  });
  document.querySelector('[data-release-label]').textContent = translateRelease(
    releaseStatus === 'ready' || releaseStatus === 'partial' ? 'latest' : 'downloadVersion',
  );
}
document.addEventListener('site-language-change', renderReleaseState);

async function loadLatestRelease() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  renderReleaseState();
  try {
    const response = await fetch(releaseApi, {
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Release request failed: ${response.status}`);
    const release = await response.json();
    if (
      typeof release.tag_name !== 'string' ||
      !/^v\d+\.\d+\.\d+$/.test(release.tag_name) ||
      !Array.isArray(release.assets)
    ) {
      throw new Error('Invalid release data');
    }
    const resolved = [...document.querySelectorAll('[data-platform]')].map((link) => {
      const asset = release.assets.find(
        (item) =>
          typeof item.name === 'string' &&
          packagePatterns[link.dataset.platform].test(item.name) &&
          typeof item.browser_download_url === 'string' &&
          item.browser_download_url.startsWith(
            `${downloadBase}/${release.tag_name}/`,
          ),
      );
      if (!asset || asset.browser_download_url !== `${downloadBase}/${release.tag_name}/${asset.name}`)
        throw new Error('Incomplete official release');
      return { link, asset };
    });
    document.querySelector('[data-release-version]').textContent = release.tag_name;
    releaseVersion = release.tag_name;
    for (const { link, asset } of resolved) {
      link.href = asset.browser_download_url;
      if (link.classList.contains('button')) {
        link.closest('.download-card').querySelector('[data-package-name]').textContent = asset.name;
      }
    }
    releaseStatus = 'ready';
    renderReleaseState();
  } catch {
    releaseStatus = 'fallback';
    renderReleaseState();
  } finally {
    clearTimeout(timeout);
  }
}

async function markPlatform() {
  let hints;
  try {
    hints = await navigator.userAgentData?.getHighEntropyValues(['architecture', 'platform']);
  } catch { /* Browsers may withhold architecture; keep both Mac choices available. */ }
  const platform = hints?.platform || navigator.platform;
  const selected = /win/i.test(platform) ? ['windows'] : /mac/i.test(platform)
    ? hints?.architecture === 'arm' ? ['macos-arm64'] : hints?.architecture === 'x86' ? ['macos-x64'] : ['macos-x64', 'macos-arm64']
    : /linux/i.test(platform) && !/arm|aarch64/i.test(hints?.architecture || platform) ? ['linux'] : [];
  document.querySelectorAll('.download-card').forEach((card) => {
    card.classList.toggle('recommended', selected.includes(card.querySelector('[data-platform]').dataset.platform));
  });
}
markPlatform();
loadLatestRelease();
