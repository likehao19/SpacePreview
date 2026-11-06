const releasePage = 'https://github.com/likehao19/SpacePreview/releases/latest';
const releaseApi = 'https://api.github.com/repos/likehao19/SpacePreview/releases/latest';
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
  document.querySelectorAll('[data-platform][data-unavailable]').forEach((link) => {
    link.querySelector('[data-download-label]').textContent = translateRelease('releasePage');
    if (link.classList.contains('button')) {
      link.closest('.download-card').querySelector('[data-package-name]').textContent =
        translateRelease('noPackage');
    }
  });
}
document.addEventListener('site-language-change', renderReleaseState);

async function loadLatestRelease() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  renderReleaseState();
  try {
    const response = await fetch(releaseApi, {
      headers: { Accept: 'application/vnd.github+json' },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Release request failed: ${response.status}`);
    const release = await response.json();
    if (
      typeof release.tag_name !== 'string' ||
      !release.tag_name ||
      !Array.isArray(release.assets)
    ) {
      throw new Error('Invalid release data');
    }
    document.querySelector('[data-release-version]').textContent = release.tag_name;
    releaseVersion = release.tag_name;
    let missingPackage = false;
    document.querySelectorAll('[data-platform]').forEach((link) => {
      const asset = release.assets.find(
        (item) =>
          typeof item.name === 'string' &&
          packagePatterns[link.dataset.platform].test(item.name) &&
          typeof item.browser_download_url === 'string' &&
          item.browser_download_url.startsWith(
            'https://github.com/likehao19/SpacePreview/releases/download/',
          ),
      );
      if (asset) {
        link.href = asset.browser_download_url;
        if (link.classList.contains('button')) {
          link.closest('.download-card').querySelector('[data-package-name]').textContent =
            asset.name;
        }
      } else {
        missingPackage = true;
        link.dataset.unavailable = 'true';
        link.href = releasePage;
        link.querySelector('[data-download-arrow]').textContent = '↗';
      }
    });
    releaseStatus = missingPackage ? 'partial' : 'ready';
    renderReleaseState();
  } catch {
    releaseStatus = 'fallback';
    renderReleaseState();
  } finally {
    clearTimeout(timeout);
  }
}

loadLatestRelease();
