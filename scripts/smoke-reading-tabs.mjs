import { chromium, expect } from '@playwright/test';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { zipSync, strToU8 } from 'fflate';
import { fileURLToPath } from 'node:url';
import './reading-fixtures.mjs';
import './large-fixtures.mjs';
import { fixture as pdfFixture } from './pdf-pages-fixture.mjs';

await mkdir('test-results/fixtures', { recursive: true });
const markdown =
  '# Reading width\n\n' +
  Array.from(
    { length: 150 },
    (_, i) => `## Section ${i}\n\nParagraph ${i} with enough text for reading.\n\n`,
  ).join('');
await writeFile('test-results/fixtures/tab-reading.md', markdown);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 850 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const csp = JSON.parse(await readFile('src-tauri/tauri.conf.json', 'utf8')).app.security.csp;
  const url = process.env.UI_TEST_URL || 'http://127.0.0.1:1434';
  await page.route(url + '/', async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      headers: { ...response.headers(), 'content-security-policy': csp },
    });
  });
  await page.addInitScript(() =>
    localStorage.setItem('preview-preferences', JSON.stringify({ tabs: true })),
  );
  await page.goto(url);
  const open = (name, text) =>
    page
      .locator('input[type=file]')
      .setInputFiles({ name, mimeType: 'application/octet-stream', buffer: Buffer.from(text) });
  const tabs = page.getByRole('tablist', { name: '文件标签页' });
  await page.locator('input[type=file]').setInputFiles('test-results/fixtures/tab-reading.md');
  await expect(page.locator('.document-paper')).toContainText('Section 149');
  await expect(tabs).toHaveCount(0);
  const right = page.getByRole('separator', { name: '调整正文右侧宽度' });
  const before = await right.boundingBox();
  await page.mouse.move(before.x + 4, before.y + 20);
  await page.mouse.down();
  await page.mouse.move(before.x + 64, before.y + 20, { steps: 5 });
  await page.mouse.up();
  await expect(right).toHaveAttribute('aria-valuenow', '980');
  expect(
    await page
      .locator('.document-paper')
      .evaluate((node) => Math.round(node.getBoundingClientRect().width)),
  ).toBe(980);
  const left = page.getByRole('separator', { name: '调整正文左侧宽度' });
  await left.focus();
  await page.keyboard.press('ArrowRight');
  await expect(left).toHaveAttribute('aria-valuenow', '948');
  await page.locator('.document-scroll').evaluate((node) => {
    node.scrollTop = 1200;
  });
  await open('code.ts', 'const value = 42;\n'.repeat(120));
  await expect(page.locator('.code-scroll')).toBeVisible();
  await expect(tabs.getByRole('tab')).toHaveCount(2);
  const centered = await page.locator('.code-scroll > pre').evaluate((node) => {
    const box = node.getBoundingClientRect();
    const parent = node.parentElement.getBoundingClientRect();
    return Math.abs(box.x + box.width / 2 - parent.x - parent.width / 2);
  });
  expect(centered).toBeLessThan(2);
  await tabs.getByRole('tab', { name: 'tab-reading.md', exact: true }).click();
  await expect
    .poll(() => page.locator('.document-scroll').evaluate((node) => node.scrollTop))
    .toBeGreaterThan(1150);
  await page.locator('input[type=file]').setInputFiles('test-results/fixtures/tab-reading.md');
  await expect(tabs.getByRole('tab')).toHaveCount(2);
  await page.keyboard.press('Space');
  await expect(tabs).toHaveCount(0);
  await expect(page.locator('.code-scroll')).toBeVisible();
  await page.getByTitle('更多选项', { exact: true }).click();
  await expect(page.getByLabel('阅读宽度', { exact: true })).toHaveCount(0);
  await page.getByLabel('关闭更多选项').click({ position: { x: 10, y: 100 } });
  await open('notes.txt', 'A plain text paragraph.\n'.repeat(200));
  await expect(page.locator('.plain-text .code-scroll')).toBeVisible();
  await tabs.getByRole('tab', { name: 'code.ts', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(tabs.getByRole('tab', { name: 'notes.txt', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  const inner = zipSync({ 'inside.txt': strToU8('Nested archive body') });
  await open(
    'nested.zip',
    zipSync({ 'folder/inner.zip': inner, 'folder/readme.md': strToU8('# Archived heading') }),
  );
  await page.getByRole('button', { name: 'folder', exact: true }).click();
  await page.getByRole('button', { name: 'inner.zip', exact: true }).click();
  await page.getByRole('button', { name: 'inside.txt', exact: true }).click();
  await expect(page.locator('.code-scroll')).toContainText('Nested archive body');
  await tabs.getByRole('tab', { name: 'notes.txt', exact: true }).click();
  await expect(page.locator('.archive-tree-preview')).toHaveCount(0);
  await tabs.getByRole('tab', { name: 'nested.zip', exact: true }).click();
  await expect(page.locator('.code-scroll')).toContainText('Nested archive body', {
    timeout: 20000,
  });
  await page.locator('input[type=file]').setInputFiles(fileURLToPath(pdfFixture));
  await expect(page.locator('.pdf-page')).toHaveCount(40, { timeout: 20000 });
  await page
    .locator('.pdf-page')
    .nth(19)
    .evaluate((node) => node.scrollIntoView());
  await expect(page.locator('.pdf-page').nth(19)).toHaveAttribute('data-rendered', 'true');
  await tabs.getByRole('tab', { name: 'notes.txt', exact: true }).click();
  await expect(page.locator('.pdf-page')).toHaveCount(0);
  await tabs.getByRole('tab', { name: /continuous-pages/ }).click();
  await expect(page.locator('.pdf-page').nth(19)).toHaveAttribute('data-rendered', 'true', {
    timeout: 20000,
  });
  await expect(page.locator('.pdf-page').nth(19)).toBeInViewport();
  await page.locator('input[type=file]').setInputFiles('test-results/fixtures/样式文档.docx');
  const word = page.frameLocator('iframe[title="Word 原样预览"]');
  await expect(word.locator('section.docx')).toHaveCount(2, { timeout: 20000 });
  await word.locator('body').evaluate(() => window.scrollTo(0, 400));
  await tabs.getByRole('tab', { name: 'notes.txt', exact: true }).click();
  await expect(page.locator('iframe')).toHaveCount(0);
  await tabs.getByRole('tab', { name: '样式文档.docx', exact: true }).click();
  await expect.poll(() => word.locator('body').evaluate(() => window.scrollY)).toBeGreaterThan(350);
  await page.getByTitle('更多选项', { exact: true }).click();
  await page.getByRole('button', { name: '偏好设置', exact: true }).click();
  await page
    .getByRole('navigation', { name: '设置分类' })
    .getByRole('button', { name: '预览', exact: true })
    .click();
  await page.getByRole('switch', { name: '自动换行', exact: true }).click();
  await page.getByRole('button', { name: '返回预览', exact: true }).click();
  await open('nowrap.ts', `const content = "${'a'.repeat(1000)}";`);
  const codeViewport = page.locator('.code-scroll');
  await expect(codeViewport).toBeVisible();
  expect(await codeViewport.evaluate((node) => node.scrollWidth > node.clientWidth)).toBe(true);
  await expect(page.locator('.reading-width-code [role="separator"]')).toHaveCount(2);
  await page.locator('input[type=file]').setInputFiles('test-results/fixtures/large.log');
  await expect(page.locator('.continuous-content')).toContainText('文件末尾标记', {
    timeout: 30000,
  });
  await page.locator('.code-scroll').evaluate((node) => {
    node.scrollTop = node.scrollHeight;
  });
  const tailPosition = await page.locator('.code-scroll').evaluate((node) => node.scrollTop);
  await page.locator('input[type=file]').setInputFiles('test-results/fixtures/large.docx');
  await expect(word.locator('section.docx')).toHaveCount(2, { timeout: 30000 });
  await expect
    .poll(() =>
      word
        .locator('img')
        .first()
        .evaluate((node) => node.naturalWidth),
    )
    .toBeGreaterThan(0);
  await expect(page.locator('.continuous-content')).toHaveCount(0);
  await tabs.getByRole('tab', { name: 'large.log', exact: true }).click();
  await expect(page.locator('.continuous-content')).toContainText('文件末尾标记', {
    timeout: 30000,
  });
  await expect
    .poll(() =>
      page
        .locator('.code-scroll')
        .evaluate((node, position) => Math.abs(node.scrollTop - position), tailPosition),
    )
    .toBeLessThan(5);
  await expect(page.locator('iframe')).toHaveCount(0);
  await page.setViewportSize({ width: 640, height: 480 });
  await tabs.getByRole('tab', { name: 'notes.txt', exact: true }).click();
  await expect(page.locator('.code-scroll')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('.code-scroll').evaluate((node) => {
    node.scrollTop = 700;
  });
  await page.screenshot({ path: 'test-results/issue3-tabs-small.png' });
  await page.keyboard.press('Escape');
  await expect(tabs).toHaveCount(0);
  await expect(page.locator('.preview-container')).toHaveCount(0);
  expect(errors).toEqual([]);
  const defaults = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  await defaults.goto(url);
  const input = defaults.locator('input[type=file]');
  await input.setInputFiles({
    name: 'one.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('first'),
  });
  await input.setInputFiles({
    name: 'two.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('second'),
  });
  await expect(defaults.getByRole('tablist', { name: '文件标签页' })).toHaveCount(0);
  await expect(defaults.locator('.code-scroll')).toContainText('second');
  const settings = async () => {
    await defaults.getByTitle('更多选项', { exact: true }).click();
    await defaults.getByRole('button', { name: '偏好设置', exact: true }).click();
    await defaults
      .getByRole('navigation', { name: '设置分类' })
      .getByRole('button', { name: '预览', exact: true })
      .click();
  };
  await settings();
  await defaults.getByRole('switch', { name: '使用文件标签页' }).click();
  await defaults.getByRole('button', { name: '返回预览', exact: true }).click();
  await input.setInputFiles({
    name: 'three.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('third'),
  });
  await expect(defaults.getByRole('tablist', { name: '文件标签页' }).getByRole('tab')).toHaveCount(
    2,
  );
  await settings();
  await defaults.getByRole('switch', { name: '使用文件标签页' }).click();
  await defaults.getByRole('button', { name: '返回预览', exact: true }).click();
  await expect(defaults.getByRole('tablist', { name: '文件标签页' })).toHaveCount(0);
  await expect(defaults.locator('.code-scroll')).toContainText('third');
  for (const platform of ['windows', 'macos']) {
    const native = await browser.newPage();
    await native.addInitScript((platform) => {
      localStorage.setItem('preview-preferences', JSON.stringify({ tabs: true }));
      localStorage.setItem('space-settings', JSON.stringify({ closeOnBlur: true }));
      window.isTauri = true;
      window.nativeCalls = [];
      const callbacks = {},
        listeners = {};
      let id = 0;
      window.emitNative = (event, payload) => callbacks[listeners[event]]?.({ event, payload });
      window.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener() {} };
      window.__TAURI_INTERNALS__ = {
        metadata: { currentWindow: { label: 'main' }, currentWebview: { label: 'main' } },
        transformCallback(callback) {
          callbacks[++id] = callback;
          return id;
        },
        unregisterCallback() {},
        async invoke(command, args) {
          window.nativeCalls.push(command);
          if (command === 'initial_paths') return { paths: [], text: false };
          if (command === 'agent_status')
            return { platform, supported: true, running: true, enabled: true };
          if (command === 'plugin:event|listen') {
            listeners[args.event] = args.handler;
            return ++id;
          }
          if (command === 'plugin:window|current_monitor' || command === 'plugin:updater|check')
            return null;
          if (
            [
              'plugin:window|is_maximized',
              'plugin:window|is_fullscreen',
              'plugin:window|is_focused',
              'autostart_enabled',
            ].includes(command)
          )
            return false;
          if (command === 'file_icon') return new ArrayBuffer(0);
          if (command === 'inspect_file') {
            if (args.path.includes('missing')) throw new Error('simulated missing file');
            const name = args.path.split('/').at(-1);
            return {
              id: args.path,
              path: args.path,
              name,
              size: new TextEncoder().encode(name).length,
              modified: 1,
              mime: 'text/plain',
            };
          }
          if (command === 'read_prefix' || command === 'read_range') {
            const bytes = new TextEncoder().encode(args.path.split('/').at(-1));
            return bytes.slice(args.offset ?? 0, (args.offset ?? 0) + args.limit).buffer;
          }
          if (command === 'navigate_file_selection') return 'C:/tests/b.txt';
        },
      };
    }, platform);
    await native.goto(url);
    const openNative = async (name) => {
      await native
        .locator('input[type=file]')
        .setInputFiles({ name, mimeType: 'text/plain', buffer: Buffer.from(name) });
      await expect(native.locator('.code-scroll')).toContainText(name);
    };
    const hideCount = () =>
      native.evaluate(() => window.nativeCalls.filter((name) => name === 'hide_preview').length);
    await openNative('first.txt');
    await openNative('second.txt');
    await native.keyboard.press('Space');
    await expect(native.locator('.code-scroll')).toContainText('first.txt');
    expect(await hideCount()).toBe(0);
    await native.keyboard.press('Space');
    await expect(native.locator('.preview-layer')).toHaveCount(0);
    expect(await hideCount()).toBe(1);
    await openNative('first.txt');
    await openNative('second.txt');
    await native
      .locator(
        platform === 'macos'
          ? '.mac-window-controls button[aria-label="关闭预览"]'
          : '.close-button',
      )
      .click();
    await expect(native.locator('.preview-tabs')).toHaveCount(0);
    expect(await hideCount()).toBe(2);
    await openNative('first.txt');
    await openNative('second.txt');
    await native.evaluate(() => window.emitNative('tauri://blur', null));
    await expect(native.locator('.preview-tabs')).toHaveCount(0);
    expect(await hideCount()).toBe(3);
    await native.evaluate(() => window.emitNative('tauri://focus', null));
    await expect(native.locator('.preview-tabs [role="tab"]')).toHaveCount(2);
    await expect(native.locator('.code-scroll')).toContainText('second.txt');
    await native.evaluate(() => window.emitNative('preview-closed', null));
    await expect(native.locator('.preview-tabs')).toHaveCount(0);
    await native.evaluate(() =>
      window.emitNative('preview-files', {
        paths: ['C:/tests/a.txt', 'C:/tests/b.txt'],
        text: false,
        fileManager: true,
      }),
    );
    await expect(native.locator('.code-scroll')).toContainText('b.txt');
    await expect(native.locator('.preview-tabs [role="tab"]')).toHaveCount(2);
    await native.evaluate(() =>
      window.emitNative('preview-files', {
        paths: ['C:/tests/a.txt'],
        text: false,
        fileManager: true,
      }),
    );
    await expect(native.locator('.code-scroll')).toContainText('a.txt');
    await expect(native.locator('.preview-tabs [role="tab"]')).toHaveCount(2);
    await native.evaluate(() =>
      window.emitNative('preview-files', { paths: ['C:/tests/missing.txt'], text: false }),
    );
    await expect(native.locator('.toast')).toContainText('simulated missing file');
    await expect(native.locator('.code-scroll')).toContainText('a.txt');
    await native.locator('.code-scroll').click();
    await native.keyboard.press('ArrowDown');
    await expect(native.locator('.code-scroll')).toContainText('b.txt');
    await expect(native.locator('.preview-tabs [role="tab"]')).toHaveCount(2);
    expect(
      await native.evaluate(
        () => window.nativeCalls.filter((name) => name === 'initial_paths').length,
      ),
    ).toBe(1);
    await native.evaluate(() => window.emitNative('preview-closed', null));
    await expect(native.locator('.preview-tabs')).toHaveCount(0);
    await native.close();
  }
  console.log(
    'Reading width, centering, tabs, deduplication, keyboard, nested ZIP, PDF/Word position and inactive resource cleanup passed.',
  );
} finally {
  await browser.close();
}
