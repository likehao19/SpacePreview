import { chromium, expect } from '@playwright/test';
import { preview } from 'vite';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
const server = await preview({ preview: { host: '127.0.0.1', port: 1435 } });
const browser = await chromium.launch({
  channel: 'msedge',
  headless: true,
  args: ['--enable-unsafe-swiftshader'],
});
const report = [];
try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://127.0.0.1:1435');
  const count = 200000,
    large = Buffer.alloc(84 + 50 * count);
  large.writeUInt32LE(count, 80);
  for (let i = 0; i < count; i++) {
    const x = i % 500,
      y = Math.floor(i / 500);
    [
      x,
      y,
      Math.sin(x / 20) * 10,
      x + 1,
      y,
      Math.sin((x + 1) / 20) * 10,
      x,
      y + 1,
      Math.sin(x / 20) * 10,
    ].forEach((v, j) => large.writeFloatLE(v, 84 + 50 * i + 12 + j * 4));
  }
  await writeFile('test-results/fixtures/large-200k.stl', large);
  for (const name of ['pr2-real.stl', 'Cerberus.obj', 'assembly.stp', 'large-200k.stl']) {
    const start = performance.now();
    await page.locator('input[type=file]').setInputFiles(`test-results/fixtures/${name}`);
    await expect(page.locator('.model-loading')).toHaveCount(0, { timeout: 60000 });
    const canvas = page.locator('.model-canvas canvas');
    await expect(canvas).toBeVisible();
    const before = await canvas.screenshot();
    const bounds = await canvas.boundingBox();
    await page.mouse.move(bounds.x + bounds.width * 0.3, bounds.y + bounds.height * 0.3);
    await page.mouse.down();
    await page.mouse.move(bounds.x + bounds.width * 0.6, bounds.y + bounds.height * 0.65, {
      steps: 5,
    });
    await page.mouse.up();
    expect((await canvas.screenshot()).equals(before)).toBe(false);
    report.push({ name, openAndInteractionMs: Math.round(performance.now() - start) });
    console.log('model passed', name);
    await canvas.evaluate((el) => (window.previousGl = el.getContext('webgl2')));
    await page.locator('input[type=file]').setInputFiles({
      name: 'next.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('Next preview'),
    });
    await expect(page.locator('.code-scroll')).toContainText('Next preview');
    expect(await page.evaluate(() => window.previousGl.isContextLost())).toBe(true);
  }
  // Native IPC is mocked only at the bridge; conversion executes the real DWG helper.
  const native = await browser.newPage({ viewport: { width: 1200, height: 850 } });
  await native.exposeBinding('dwgNative', async (_, command, args) => {
    if (command === 'inspect_file') {
      const bytes = await readFile(args.path);
      return {
        id: args.path,
        path: args.path,
        name: args.path.split(/[\\/]/).pop(),
        size: bytes.length,
        modified: 1,
      };
    }
    if (command === 'read_dwg')
      return [
        ...execFileSync(
          'src-tauri/target/debug/space-preview.exe',
          ['--spacepreview-dwg', args.path],
          { timeout: 30000, maxBuffer: 17 * 1024 * 1024 },
        ),
      ];
  });
  await native.addInitScript(() => {
    window.isTauri = true;
    const callbacks = {},
      listeners = {};
    let id = 0;
    window.cancels = 0;
    window.emitNative = (event, payload) => callbacks[listeners[event]]?.({ event, payload });
    window.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener() {} };
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
        if (command === 'file_icon') return new ArrayBuffer(0);
        if (command === 'plugin:event|listen') {
          listeners[args.event] = args.handler;
          return ++id;
        }
        if (command === 'inspect_file') return window.dwgNative(command, args);
        if (command === 'read_dwg')
          return new Uint8Array(await window.dwgNative(command, args)).buffer;
        if (command === 'cancel_dwg') {
          window.cancels++;
          return;
        }
        if (command.includes('is_') || command === 'autostart_enabled') return false;
        return null;
      },
    };
  });
  await native.goto('http://127.0.0.1:1435');
  await native.locator('input[type=file]').waitFor({ state: 'attached' });
  for (const version of ['AC1015', 'AC1021', 'AC1032']) {
    await native
      .locator('input[type=file]')
      .setInputFiles({
        name: 'between.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('Between drawings'),
      });
    await expect(native.locator('.code-scroll')).toContainText('Between drawings');

    const start = performance.now();
    await native.evaluate(
      (path) => window.emitNative('preview-files', { paths: [path], text: false }),
      resolve(`test-results/fixtures/${version}.dwg`),
    );
    await expect(native.locator('.cad-body svg')).toBeVisible({ timeout: 30000 });
    expect(await native.locator('.cad-body svg polyline').count()).toBeGreaterThan(0);
    const layers = native.locator('.cad-layers input');
    expect(await layers.count()).toBeGreaterThan(1);
    const drawing = native.locator('.cad-body svg');
    const before = await drawing.getAttribute('viewBox');
    await drawing.dispatchEvent('wheel', { deltaY: -100 });
    await expect.poll(() => drawing.getAttribute('viewBox')).not.toBe(before);
    await layers.first().uncheck();
    await expect(layers.first()).not.toBeChecked();
    console.log('DWG passed', version);
    report.push({
      name: version + '.dwg',
      layers: await layers.count(),
      paths: await native.locator('.cad-body svg polyline').count(),
      openAndInteractionMs: Math.round(performance.now() - start),
    });
  }
  await native.screenshot({ path: 'test-results/dwg-real.png' });
  await native.locator('input[type=file]').setInputFiles({
    name: 'next.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('Next preview'),
  });
  await expect(native.locator('.cad-body')).toHaveCount(0);
  expect(await native.evaluate(() => window.cancels)).toBeGreaterThanOrEqual(3);
  expect(errors).toEqual([]);
  await writeFile('test-results/cad-model-report.json', JSON.stringify(report, null, 2));
  console.log(report);
} finally {
  await browser.close();
  await new Promise((r) => server.httpServer.close(r));
}
