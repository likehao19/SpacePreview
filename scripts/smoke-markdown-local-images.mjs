import { chromium, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
const source = process.argv[2];
if (!source) throw new Error('Pass the Markdown document path');
const body = await readFile(source);
const references = [...body.toString().matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)].map((m) => m[1]);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
  const csp = JSON.parse(await readFile('src-tauri/tauri.conf.json', 'utf8')).app.security.csp;
  const url = 'http://127.0.0.1:1434';
  await page.route(url + '/', async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      headers: { ...response.headers(), 'content-security-policy': csp },
    });
  });
  const reads = [];
  await page.exposeBinding('nativeRead', async (_, command, args) => {
    if (command === 'inspect_file')
      return {
        id: source,
        path: source,
        name: path.basename(source),
        size: body.length,
        modified: 1,
      };
    if (command === 'read_prefix' || command === 'read_range')
      return [...body.subarray(args.offset || 0, (args.offset || 0) + args.limit)];
    if (command === 'read_html_resource') {
      reads.push(args.relative);
      return [...(await readFile(path.join(path.dirname(source), args.relative)))];
    }
  });
  await page.addInitScript(() => {
    window.isTauri = true;
    const callbacks = {},
      listeners = {};
    let id = 0;
    window.emitNative = (event, payload) => callbacks[listeners[event]]?.({ event, payload });
    window.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener() {} };
    window.created = [];
    window.revoked = [];
    const create = URL.createObjectURL.bind(URL),
      revoke = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = (blob) => {
      const url = create(blob);
      window.created.push(url);
      return url;
    };
    URL.revokeObjectURL = (url) => {
      window.revoked.push(url);
      revoke(url);
    };
    window.__TAURI_INTERNALS__ = {
      metadata: { currentWindow: { label: 'main' }, currentWebview: { label: 'main' } },
      transformCallback(cb) {
        callbacks[++id] = cb;
        return id;
      },
      unregisterCallback() {},
      async invoke(command, args) {
        if (command === 'initial_paths') return { paths: [], text: false };
        if (command === 'agent_status')
          return { platform: 'windows', supported: true, running: true, enabled: true };
        if (command === 'plugin:event|listen') {
          listeners[args.event] = args.handler;
          return ++id;
        }
        if (command === 'file_icon') return new ArrayBuffer(0);
        if (['inspect_file', 'read_prefix', 'read_range', 'read_html_resource'].includes(command)) {
          const data = await window.nativeRead(command, args);
          return command === 'inspect_file' ? data : new Uint8Array(data).buffer;
        }
        if (command.includes('is_') || command === 'autostart_enabled') return false;
        return null;
      },
    };
  });
  await page.goto(url);
  await page.locator('input[type=file]').waitFor({ state: 'attached' });
  await page.evaluate(
    (source) => window.emitNative('preview-files', { paths: [source], text: false }),
    source,
  );
  const images = page.locator('img[data-local-image]');
  await expect(images).toHaveCount(references.length);
  await expect.poll(() => images.first().evaluate((img) => img.naturalWidth)).toBeGreaterThan(0);
  expect(reads.length).toBeLessThan(new Set(references).size);
  for (let i = 0; i < references.length; i++) {
    await images.nth(i).scrollIntoViewIfNeeded();
    await expect.poll(() => images.nth(i).evaluate((img) => img.naturalWidth)).toBeGreaterThan(0);
  }
  expect(reads.length).toBe(new Set(references).size);
  await page
    .locator('input[type=file]')
    .setInputFiles({
      name: 'next.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('Next preview'),
    });
  await expect(page.locator('.code-scroll')).toContainText('Next preview');
  await expect
    .poll(() =>
      page.evaluate(() => window.created.filter((url) => !window.revoked.includes(url)).length),
    )
    .toBe(0);
  console.log(
    `${references.length} actual local image references loaded; reads deduplicated; offscreen reads deferred; object URLs released on switch; production CSP passed.`,
  );
} finally {
  await browser.close();
}
