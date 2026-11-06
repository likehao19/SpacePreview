const releasePage = 'https://github.com/likehao19/SpacePreview/releases/latest';
const releaseApi = 'https://api.github.com/repos/likehao19/SpacePreview/releases/latest';
const packagePatterns = {
  windows: /-windows-x64-setup\.exe$/i,
  'macos-x64': /-macos-x64\.dmg$/i,
  'macos-arm64': /-macos-arm64\.dmg$/i,
  linux: /-linux-x64\.AppImage$/i,
  'linux-deb': /-linux-x64\.deb$/i,
};

async function loadLatestRelease() {
  const state = document.querySelector('[data-release-state]');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  state.textContent = '正在检查最新版本…';
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
    document.querySelector('[data-release-label]').textContent = '最新版本';
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
        link.href = releasePage;
        link.querySelector('[data-download-label]').textContent = '查看发布页';
        link.querySelector('[data-download-arrow]').textContent = '↗';
        if (link.classList.contains('button')) {
          link.closest('.download-card').querySelector('[data-package-name]').textContent =
            '此版本暂无对应安装包';
        }
      }
    });
    state.textContent = `最新版本 ${release.tag_name}${missingPackage ? ' · 部分安装包请查看发布页' : ' · 点击即可下载'}`;
  } catch {
    state.textContent = '暂时无法检查最新版本，仍可直接下载备用版本 v0.10.14';
  } finally {
    clearTimeout(timeout);
  }
}

loadLatestRelease();
