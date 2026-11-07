import { preview } from 'vite';
import { chromium, expect } from '@playwright/test';
const server = await preview({ preview: { host: '127.0.0.1', port: 1435 } });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage();
  await page.addInitScript(() => {
    window.isTauri = true;
    window.listens = {};
    window.inspected = [];
    const callbacks = {},
      listeners = {};
    let id = 0;
    window.emitNative = (event, payload) => callbacks[listeners[event]]?.({ event, payload });
    window.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener() {} };
    const file = (path) => ({
      id: path,
      path,
      name: path.split('/').pop(),
      size: path.split('/').pop().length,
      modified: 1,
    });
    window.__TAURI_INTERNALS__ = {
      metadata: { currentWindow: { label: 'main' }, currentWebview: { label: 'main' } },
      transformCallback(cb) {
        callbacks[++id] = cb;
        return id;
      },
      unregisterCallback() {},
      async invoke(command, args) {
        if (command === 'agent_status')
          return { platform: 'windows', supported: true, running: true, enabled: true };
        if (command === 'initial_paths')
          return new Promise(
            (resolve) =>
              (window.releaseInitial = () =>
                resolve({ paths: ['C:/test/stale.txt'], text: false })),
          );
        if (command === 'plugin:event|listen') {
          window.listens[args.event] = (window.listens[args.event] || 0) + 1;
          listeners[args.event] = args.handler;
          return ++id;
        }
        if (command === 'inspect_file') {
          window.inspected.push(args.path);
          if (args.path.endsWith('slow.txt'))
            return new Promise(
              (resolve) => (window.releaseInspect = () => resolve(file(args.path))),
            );
          return file(args.path);
        }
        if (command === 'read_prefix' || command === 'read_range')
          return new TextEncoder().encode(args.path.split('/').pop()).buffer;
        if (command === 'file_icon') return new ArrayBuffer(0);
        if (command === 'plugin:window|is_focused') return true;
        if (command.includes('is_') || command === 'autostart_enabled') return false;
        return null;
      },
    };
  });
  await page.goto('http://127.0.0.1:1435');
  await page.waitForFunction(() => window.releaseInitial);
  await page.evaluate(() =>
    window.emitNative('preview-files', {
      paths: ['C:/test/slow.txt'],
      text: false,
      fileManager: true,
    }),
  );
  await expect(page.getByText('正在读取文件…', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '使用指南', exact: true })).toHaveCount(0);
  await page.evaluate(() => window.releaseInspect());
  await expect(page.locator('.code-scroll')).toContainText('slow.txt');
  await page.evaluate(() => window.releaseInitial());
  await page.evaluate(() => new Promise(requestAnimationFrame));
  await expect(page.locator('.code-scroll')).toContainText('slow.txt');
  expect(await page.evaluate(() => window.inspected.includes('C:/test/stale.txt'))).toBe(false);
  const before = await page.evaluate(() => window.listens['preview-files']);
  await page.getByTitle('更多选项', { exact: true }).click();
  await page.getByRole('button', { name: '偏好设置', exact: true }).click();
  await page
    .getByRole('navigation', { name: '设置分类' })
    .getByRole('button', { name: '预览', exact: true })
    .click();
  await page.getByRole('switch', { name: '使用文件标签页' }).click();
  await page.evaluate(() =>
    window.emitNative('preview-files', {
      paths: ['C:/test/first-press.txt'],
      text: false,
      fileManager: true,
    }),
  );
  await expect(page.locator('.code-scroll')).toContainText('first-press.txt');
  expect(await page.evaluate(() => window.listens['preview-files'])).toBe(before);
  console.log(
    'First native event, delayed metadata loading, stale startup result protection, settings dismissal and stable listener after preference changes passed.',
  );
} finally {
  await browser.close();
  await new Promise((r) => server.httpServer.close(r));
}
