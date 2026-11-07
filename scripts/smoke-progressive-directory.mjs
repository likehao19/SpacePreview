import { chromium, expect } from '@playwright/test';
import fs from 'node:fs';
import { unzipSync, zipSync } from 'fflate';
import './reading-fixtures.mjs';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const url = process.env.UI_TEST_URL || 'http://127.0.0.1:1424';
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
  page.on('pageerror', (error) => errors.push(error.message));
  const parts = unzipSync(fs.readFileSync('test-results/fixtures/样式文档.docx'));
  const extraPages = Array.from(
    { length: 10 },
    (_, index) =>
      `<w:p><w:pPr><w:pageBreakBefore/></w:pPr><w:r><w:t>后续页面 ${index + 3}</w:t></w:r></w:p>`,
  ).join('');
  parts['word/document.xml'] = new TextEncoder().encode(
    new TextDecoder()
      .decode(parts['word/document.xml'])
      .replace('<w:sectPr>', extraPages + '<w:sectPr>'),
  );
  const image = new Uint8Array(2012345);
  image.set(parts['word/media/logo.png']);
  parts['word/media/logo.png'] = image;
  parts['word/media/unused.bin'] = new Uint8Array(8 * 1024 * 1024);
  const bytes = zipSync(parts, { level: 0 });
  await page.addInitScript(() => {
    document.addEventListener(
      'load',
      (event) => {
        if (!(event.target instanceof HTMLIFrameElement)) return;
        const document = event.target.contentDocument;
        if (!document?.body) return;
        new MutationObserver(() => {
          const count = document.querySelectorAll('section.docx').length;
          if (count && !window.firstPageCount) window.firstPageCount = count;
        }).observe(document.body, { childList: true, subtree: true });
      },
      true,
    );
    const read = Blob.prototype.arrayBuffer;
    window.imagePending = false;
    Blob.prototype.arrayBuffer = async function () {
      if (this.size === 2012345) {
        window.imagePending = true;
        await new Promise((resolve) => {
          window.releaseImage = resolve;
        });
      }
      if (this.size === 8 * 1024 * 1024) throw new Error('Unreferenced resource was read');
      return read.call(this);
    };
  });
  await page.goto(url);
  const openWord = () =>
    page.locator('input[type=file]').setInputFiles({
      name: '渐进排版.docx',
      mimeType: 'application/octet-stream',
      buffer: Buffer.from(bytes),
    });
  await openWord();
  const frame = page.frameLocator('iframe[title="Word 原样预览"]');
  await expect(frame.locator('section.docx')).toHaveCount(12, { timeout: 20000 });
  expect(await page.evaluate(() => window.firstPageCount)).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.firstPageCount)).toBeLessThanOrEqual(12);
  await expect(frame.locator('table')).toBeVisible();
  await expect(frame.locator('.word-heading-0 span').first()).toHaveCSS(
    'color',
    'rgb(40, 94, 128)',
  );
  await expect.poll(() => page.evaluate(() => window.imagePending)).toBe(true);
  await expect(page.locator('.preview-loading-toast')).toBeVisible();
  expect(await frame.locator('img').evaluate((img) => img.naturalWidth)).toBe(0);
  await page.screenshot({ path: 'test-results/word-progressive-first-page.png' });
  await page.evaluate(() => window.releaseImage());
  await expect.poll(() => frame.locator('img').evaluate((img) => img.naturalWidth)).toBe(1);
  await expect(page.locator('.word-status')).toHaveCount(0);
  await openWord();
  await expect.poll(() => page.evaluate(() => window.imagePending)).toBe(true);
  await expect(page.locator('.preview-loading-toast')).toBeVisible();
  await page.locator('input[type=file]').setInputFiles({
    name: 'other.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('切换后内容'),
  });
  await page.evaluate(() => window.releaseImage());
  await expect(page.locator('.code-scroll')).toContainText('切换后内容');
  await expect(page.locator('iframe[title="Word 原样预览"]')).toHaveCount(0);
  await page.locator('input[type=file]').setInputFiles({
    name: 'unknown.custom',
    mimeType: 'application/octet-stream',
    buffer: Buffer.concat([Buffer.from('MZ'), Buffer.alloc(126)]),
  });
  await expect(page.locator('.binary-preview')).toBeVisible();
  await expect(page.locator('.binary-heading h2')).toHaveText('unknown.custom');
  await expect(page.locator('.preview-loading-toast')).toHaveCount(0);
  await page.screenshot({ path: 'test-results/unknown-file-info.png' });

  const folder = await browser.newPage({ viewport: { width: 1100, height: 800 } });
  folder.on('pageerror', (error) => errors.push(error.message));
  await folder.addInitScript(() => {
    window.isTauri = true;
    const callbacks = {};
    const listeners = {};
    let id = 0;
    const item = (path, directory = true) => ({
      id: path,
      path,
      name: path.split('/').at(-1),
      directory,
      size: 30,
      modified: 0,
      mime: 'text/plain',
    });
    window.treeReads = [];
    window.emitSelectionError = () =>
      callbacks[listeners['agent-selection-error']]({
        payload: '所选项目没有本地文件路径，暂不支持此类系统图标预览。',
      });
    window.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener() {} };
    window.__TAURI_INTERNALS__ = {
      metadata: { currentWindow: { label: 'main' }, currentWebview: { label: 'main' } },
      transformCallback(callback) {
        callbacks[++id] = callback;
        return id;
      },
      unregisterCallback() {},
      async invoke(command, args) {
        if (command === 'plugin:event|listen') {
          listeners[args.event] = args.handler;
          return ++id;
        }
        if (command === 'initial_paths') return { paths: ['/project'], text: false };
        if (command === 'inspect_file') return item(args.path);
        if (command === 'list_siblings') return [item('/project')];
        if (command === 'agent_status') return { supported: true, enabled: true, running: true };
        if (command === 'autostart_enabled' || command === 'plugin:window|is_maximized')
          return false;
        if (command === 'file_icon') return new ArrayBuffer(0);
        if (command === 'read_prefix')
          return new TextEncoder().encode('export const project = "hello";').buffer;
        if (command === 'read_range')
          return new TextEncoder()
            .encode('export const project = "hello";')
            .slice(args.offset, args.offset + args.limit).buffer;
        if (command === 'list_directory') {
          window.treeReads.push(args.path);
          if (args.path === '/project')
            return {
              entries: [
                item('/project/src'),
                item('/project/empty'),
                item('/project/denied'),
                item('/project/README.md', false),
              ],
              nextOffset: args.offset ? null : 500,
            };
          if (args.path === '/project/denied') throw new Error('没有读取权限');
          if (args.path === '/project/empty') return { entries: [], nextOffset: null };
          const depth = args.path.split('/').length;
          return {
            entries: [item(args.path + (depth < 6 ? '/nested' : '/main.ts'), depth < 6)],
            nextOffset: null,
          };
        }
      },
    };
  });
  await folder.goto(url);
  await expect(folder.getByRole('tree')).toBeVisible();
  expect(await folder.evaluate(() => window.treeReads)).toEqual(['/project']);
  await folder.getByRole('button', { name: 'src', exact: true }).click();
  for (let depth = 0; depth < 3; depth++)
    await folder.getByRole('button', { name: 'nested', exact: true }).last().click();
  await folder.getByRole('button', { name: 'main.ts', exact: true }).click();
  await expect(folder.locator('.code-scroll')).toContainText('export const project');
  await folder.getByRole('button', { name: 'empty', exact: true }).click();
  await expect(folder.getByText('空文件夹', { exact: true })).toBeVisible();
  await folder.getByRole('button', { name: 'denied', exact: true }).click();
  await expect(folder.getByRole('alert')).toContainText('没有读取权限');
  await folder.getByRole('button', { name: '加载更多', exact: true }).click();
  await expect(folder.getByRole('button', { name: '加载更多', exact: true })).toHaveCount(0);
  await folder.screenshot({ path: 'test-results/directory-tree.png' });
  await folder.setViewportSize({ width: 640, height: 480 });
  expect(
    await folder
      .locator('.directory-preview')
      .evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
  ).toBe(true);
  await folder.getByRole('button', { name: 'src', exact: true }).focus();
  await folder.keyboard.press('ArrowLeft');
  await expect(folder.getByRole('button', { name: 'main.ts', exact: true })).toHaveCount(0);
  await expect(folder.locator('.code-scroll')).toContainText('export const project');
  await folder.evaluate(() => window.emitSelectionError());
  await expect(folder.getByRole('heading', { name: '暂不支持预览此项目' })).toBeVisible();
  await expect(folder.locator('.settings-workspace')).toHaveCount(0);
  await expect(folder.locator('.toast')).toHaveCount(0);
  await folder.keyboard.press('Escape');
  await expect(folder.getByRole('heading', { name: '使用指南', exact: true })).toBeVisible();
  await folder.evaluate(() => window.emitSelectionError());
  await expect(folder.getByRole('heading', { name: '暂不支持预览此项目' })).toBeVisible();
  await folder.locator('.unsupported-preview').click();
  await folder.keyboard.press('Space');
  await expect(folder.getByRole('heading', { name: '使用指南', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
  console.log(
    'Passed: styled Word pages before delayed images, resource completion/cancellation, unknown-file information, lazy deep directory tree, paging, empty/error branches and keyboard collapse.',
  );
} finally {
  await browser.close();
}
