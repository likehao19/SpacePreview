import { chromium, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const websiteUrl = new URL('../website/index.html', import.meta.url).href;
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const errors = [];
const releaseApi = 'https://api.github.com/repos/likehao19/SpacePreview/releases/latest';
const releaseBase = 'https://github.com/likehao19/SpacePreview/releases/download/v99.0.0/';
const packageNames = [
  'SpacePreview-99.0.0-windows-x64-setup.exe',
  'SpacePreview-99.0.0-macos-x64.dmg',
  'SpacePreview-99.0.0-macos-arm64.dmg',
  'SpacePreview-99.0.0-linux-x64.AppImage',
  'SpacePreview-99.0.0-linux-x64.deb',
];
const releaseFixture = {
  tag_name: 'v99.0.0',
  assets: [
    // 签名、更新包和其他架构不得被选作对应安装包。
    ...[
      'SpacePreview-99.0.0-windows-x64-setup.exe.sig',
      'SpacePreview-99.0.0-macos-arm64.app.tar.gz',
      'SpacePreview-99.0.0-linux-arm64.AppImage',
      ...packageNames,
    ].map((name) => ({ name, browser_download_url: releaseBase + name })),
  ],
};
try {
  const page = await browser.newPage({ locale: 'zh-CN', viewport: { width: 1440, height: 1000 } });
  await page.route(releaseApi, (route) => route.fulfill({ json: releaseFixture }));
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('requestfailed', (request) => {
    // 浏览器接管附件下载时会中止导航请求；下方单独断言下载完成。
    if (
      request.url().startsWith(releaseBase) &&
      request.failure()?.errorText === 'net::ERR_ABORTED'
    )
      return;
    errors.push(request.url());
  });
  // 官网应可直接离线打开，内容不依赖其他本机目录。
  await page.goto(websiteUrl);
  await expect(page).toHaveTitle(/SpacePreview/);
  await expect(page.locator('h1')).toContainText('不必打开');
  await page.keyboard.press('Tab');
  await expect(page.locator('.skip-link')).toBeFocused();
  await expect(page.locator('.skip-link')).toHaveCSS('opacity', '1');
  await expect(page.locator('[data-release-state]')).toContainText('最新版本 v99.0.0');
  await expect(page.locator('[data-release-version]')).toHaveText('v99.0.0');
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', 'assets/app-icon.png');
  expect(fs.readFileSync(path.join(root, 'website/assets/app-icon.png'))).toEqual(
    fs.readFileSync(path.join(root, 'src-tauri/icons/icon.png')),
  );
  await page.route(`${releaseBase}*`, (route) =>
    route.fulfill({
      headers: {
        'Content-Disposition': `attachment; filename="${route.request().url().split('/').pop()}"`,
      },
      contentType: 'application/octet-stream',
      body: 'Website download test fixture, not an installer.',
    }),
  );
  for (const [index, platform] of [
    'windows',
    'macos-x64',
    'macos-arm64',
    'linux',
    'linux-deb',
  ].entries()) {
    const button = page.locator(`[data-platform="${platform}"]`);
    await expect(button).toHaveAttribute('href', releaseBase + packageNames[index]);
    const downloadEvent = page.waitForEvent('download');
    await button.click();
    const download = await downloadEvent;
    expect(download.suggestedFilename()).toBe(packageNames[index]);
    expect(await download.failure()).toBeNull();
    await download.delete();
    expect(page.url()).toBe(websiteUrl);
  }
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.locator('body').click({ position: { x: 5, y: 5 } });

  const loadedImages = async () => {
    await page.waitForFunction(() =>
      [...document.querySelectorAll('img[src]')].every(
        (image) => image.complete && image.naturalWidth > 0,
      ),
    );
  };
  await page.locator('#preview-image').scrollIntoViewIfNeeded();
  await loadedImages();
  const tabs = page.getByRole('tab');
  await expect(tabs).toHaveCount(7);
  for (let index = 0; index < 7; index++) {
    await tabs.nth(index).click();
    await expect(tabs.nth(index)).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('[role="tab"][aria-selected="true"]')).toHaveCount(1);
    await expect(page.getByRole('tabpanel')).toHaveAttribute(
      'aria-labelledby',
      await tabs.nth(index).getAttribute('id'),
    );
    await loadedImages();
    await expect(page.locator('#preview-image')).not.toHaveAttribute('alt', '');
    await page.locator('.screenshot-open').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.locator('#dialog-image')).toHaveAttribute(
      'src',
      await page.locator('#preview-image').evaluate((image) => image.src),
    );
    await loadedImages();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
  }
  await tabs.first().focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: '代码高亮' })).toBeFocused();
  await expect(page.getByRole('tab', { name: '代码高亮' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page.keyboard.press('End');
  await expect(tabs.last()).toBeFocused();
  await page.keyboard.press('Home');
  await expect(tabs.first()).toBeFocused();
  await page.locator('.screenshot-open').click();
  await page.getByRole('button', { name: '关闭大图' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.locator('.screenshot-open').click();
  await page.mouse.click(2, 2);
  await expect(page.getByRole('dialog')).not.toBeVisible();

  await expect(
    page.locator('header a[href="https://github.com/likehao19/SpacePreview"]'),
  ).toHaveCount(1);
  await expect(page.locator('.download-card .os-icon svg')).toHaveCount(4);
  await page.locator('#features').scrollIntoViewIfNeeded();
  await expect(page.locator('#features .section-heading')).toHaveClass(/is-revealed/);
  await page.locator('.all-formats summary').click();
  expect(await page.locator('.format-table tbody tr').count()).toBeGreaterThan(30);
  await expect(page.locator('.format-table thead th')).toHaveCount(2);
  expect(
    await page
      .locator('.format-table tbody tr')
      .evaluateAll((rows) => rows.every((row) => row.children.length === 2)),
  ).toBe(true);
  await expect(page.locator('.format-table')).toContainText('ZIP');
  await page.locator('.all-formats summary').click();
  await page.getByText('三个系统都支持空格唤起吗？', { exact: true }).click();
  await expect(page.locator('.faq-list details[open]')).toContainText('Linux');
  await page.getByText('三个系统都支持空格唤起吗？', { exact: true }).click();
  for (const link of await page
    .locator('a[href^="#"]')
    .evaluateAll((links) => links.map((link) => link.getAttribute('href')))) {
    if (link !== '#') await expect(page.locator(link)).toHaveCount(1);
  }
  expect(fs.readFileSync(path.join(root, 'website/index.html'), 'utf8')).not.toMatch(
    /linux\.do|linuxdo/i,
  );
  await expect(page.locator('#download a.button')).toHaveCount(4);
  await loadedImages();
  fs.mkdirSync(path.join(root, 'test-results'), { recursive: true });
  for (const width of [1440, 1024, 768, 760, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.locator('.all-formats summary').click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.locator('.all-formats summary').click();
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    if (width === 1440 || width === 390) {
      await page.screenshot({
        path: path.join(root, `test-results/website-${width}.png`),
        fullPage: true,
      });
    }
  }
  const noJs = await browser.newPage({ locale: 'zh-CN', javaScriptEnabled: false });
  await noJs.goto(websiteUrl);
  await expect(noJs.locator('#download')).toBeVisible();
  await expect(noJs.locator('#features')).toBeVisible();
  await expect(noJs.locator('.screenshot-open')).toHaveAttribute(
    'href',
    'assets/preview-archive.png',
  );
  await noJs.close();
  const reduced = await browser.newPage({ locale: 'zh-CN', reducedMotion: 'reduce' });
  await reduced.route(releaseApi, (route) => route.fulfill({ json: releaseFixture }));
  await reduced.goto(websiteUrl);
  expect(
    await reduced.locator('.hero').evaluate((hero) => hero.getAnimations({ subtree: true }).length),
  ).toBe(0);
  await expect(reduced.locator('#features')).toBeVisible();
  await reduced.close();
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('h1')).toContainText('Take a quick look.');
  await expect(page.locator('[data-release-state]')).toContainText('Latest release v99.0.0');
  await page.getByRole('tab', { name: 'Code highlighting', exact: true }).click();
  await expect(page.locator('#preview-caption')).toContainText('Syntax highlighting');
  await expect(page.locator('#preview-image')).toHaveAttribute('alt', 'Code highlighting');
  await page.locator('.all-formats summary').click();
  expect((await page.locator('body').innerText()).replace('中文', '')).not.toMatch(
    /[\u3400-\u9fff]/,
  );
  await page.locator('.all-formats summary').click();
  for (const width of [1440, 1024, 768, 760, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await expect(page.locator('.language-switch')).toBeVisible();
    await expect(page.locator('nav')).toBeVisible();
    if (width === 1440 || width === 390) {
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      await page.screenshot({ path: path.join(root, `test-results/website-en-${width}.png`) });
    }
  }
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('[data-release-state]')).toContainText('Latest release v99.0.0');
  await page.getByRole('button', { name: '中文', exact: true }).click();
  await expect(page.locator('h1')).toContainText('不必打开');
  await expect(page.locator('[data-release-state]')).toContainText('最新版本 v99.0.0');
  const englishDefault = await browser.newPage({ locale: 'en-US' });
  await englishDefault.route(releaseApi, (route) => route.fulfill({ json: releaseFixture }));
  await englishDefault.goto(websiteUrl);
  await expect(englishDefault.locator('html')).toHaveAttribute('lang', 'en');
  await expect(englishDefault.locator('h1')).toContainText('Take a quick look.');
  await englishDefault.close();
  for (const scenario of ['http-error', 'invalid-json', 'timeout', 'missing-package']) {
    const fallback = await browser.newPage({ locale: 'zh-CN' });
    await fallback.route(releaseApi, async (route) => {
      if (scenario === 'http-error') return route.fulfill({ status: 503, body: 'Unavailable' });
      if (scenario === 'invalid-json')
        return route.fulfill({ contentType: 'application/json', body: '{}' });
      if (scenario === 'timeout') return;
      return route.fulfill({
        json: {
          ...releaseFixture,
          assets: releaseFixture.assets.filter((asset) => !/-macos-arm64\.dmg$/i.test(asset.name)),
        },
      });
    });
    await fallback.goto(websiteUrl);
    if (scenario === 'missing-package') {
      await expect(fallback.locator('[data-release-state]')).toContainText('部分安装包');
      await expect(fallback.locator('[data-platform="macos-arm64"]')).toHaveAttribute(
        'href',
        'https://github.com/likehao19/SpacePreview/releases/latest',
      );
      await expect(fallback.locator('[data-platform="macos-arm64"]')).toContainText('查看发布页');
      await expect(fallback.locator('[data-platform="macos-x64"]')).toHaveAttribute(
        'href',
        releaseBase + packageNames[1],
      );
      await fallback.getByRole('button', { name: 'EN', exact: true }).click();
      await expect(fallback.locator('[data-release-state]')).toContainText('Some installers');
      await expect(fallback.locator('[data-platform="macos-arm64"]')).toContainText('View release');
      await expect(fallback.locator('[data-platform="macos-arm64"]')).toHaveAttribute(
        'href',
        'https://github.com/likehao19/SpacePreview/releases/latest',
      );
    } else {
      await expect(fallback.locator('[data-release-state]')).toContainText('备用版本 v0.10.20', {
        timeout: 11000,
      });
      await expect(fallback.locator('[data-platform="windows"]')).toHaveAttribute(
        'href',
        'https://github.com/likehao19/SpacePreview/releases/download/v0.10.20/SpacePreview-0.10.20-windows-x64-setup.exe',
      );
      await expect(fallback.locator('[data-release-version]')).toHaveText('v0.10.20');
      await fallback.getByRole('button', { name: 'EN', exact: true }).click();
      await expect(fallback.locator('[data-release-state]')).toContainText(
        'Backup version v0.10.20',
      );
    }
    await fallback.close();
  }
  for (const name of [
    'README.md',
    'website/README.md',
    'docs/HISTORY.md',
    'docs/PREVIEW-GUIDE.md',
  ]) {
    const source = fs.readFileSync(path.join(root, name), 'utf8');
    expect(source.charCodeAt(0)).not.toBe(0xfeff);
    for (const [, link] of source.matchAll(/\]\(([^)]+)\)/g)) {
      if (/^(https?:|#)/.test(link)) continue;
      expect(
        fs.existsSync(
          path.resolve(root, path.dirname(name), decodeURIComponent(link.split('#')[0])),
        ),
        `${name}: ${link}`,
      ).toBe(true);
    }
  }
  expect(errors).toEqual([]);
  console.log(
    'Website checks passed: bilingual content, browser language detection, saved language, localized release/missing-package states, latest release, five downloads, seven screenshots, keyboard/zoom, single GitHub header icon, six widths in both languages, reduced motion, offline/no-JS content and Markdown links.',
  );
} finally {
  await browser.close();
}
