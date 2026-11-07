import { preview } from 'vite';
import { chromium, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
const bytes = await readFile('example/字体/sample.ttf'),
  path = 'D:\\Desktop\\文件预览工具\\example\\字体\\sample.ttf';
const server = await preview({ preview: { host: '127.0.0.1', port: 1435 } }),
  browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  await page.exposeBinding('readFont', async (_, offset, length) => [
    ...bytes.subarray(offset, offset + length),
  ]);
  await page.addInitScript(
    ({ path, size }) => {
      window.isTauri = true;
      const callbacks = {},
        listeners = {};
      let id = 0;
      window.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener() {} };
      window.__TAURI_INTERNALS__ = {
        metadata: { currentWindow: { label: 'main' }, currentWebview: { label: 'main' } },
        transformCallback(cb) {
          callbacks[++id] = cb;
          return id;
        },
        unregisterCallback() {},
        async invoke(command, args) {
          if (command === 'initial_paths') return { paths: [path], text: false };
          if (command === 'agent_status')
            return { platform: 'windows', supported: true, running: true, enabled: true };
          if (command === 'plugin:event|listen') {
            listeners[args.event] = args.handler;
            return ++id;
          }
          if (command === 'inspect_file')
            return { id: path, path, name: 'sample.ttf', size, modified: 1 };
          if (command === 'file_icon') return new ArrayBuffer(0);
          if (command === 'read_prefix' || command === 'read_range')
            return new Uint8Array(await window.readFont(args.offset || 0, args.limit)).buffer;
          if (command.includes('is_') || command === 'autostart_enabled') return false;
          return null;
        },
      };
    },
    { path, size: bytes.length },
  );
  await page.goto('http://127.0.0.1:1435');
  await expect(page.locator('.font-paper h1')).toHaveText('Liberation Sans');
  await expect(page.locator('.font-metadata')).toContainText('1.07.4');
  await expect(page.locator('.font-size-row')).toHaveCount(7);
  await expect(page.locator('.font-fallback-note')).toContainText('不包含中文字形');
  const measurement = await page.evaluate(
    async ({ bytes, path }) => {
      const data = new Uint8Array(bytes).buffer,
        reference = new FontFace('font-reference', data);
      await reference.load();
      document.fonts.add(reference);
      const row = document.querySelector('.font-size-text'),
        family = getComputedStyle(row).fontFamily;
      const canvas = document.createElement('canvas'),
        ctx = canvas.getContext('2d');
      const text = 'Hamburgefontsiv 0123456789';
      const measure = (name) => {
        ctx.font = `32px ${name}`;
        return ctx.measureText(text).width;
      };
      const actual = measure(family),
        expected = measure('font-reference');
      const oldName = `preview-${path}-0`,
        old = new FontFace(oldName, data);
      await old.load();
      document.fonts.add(old);
      const oldWidth = measure(`"${oldName}"`);
      document.fonts.delete(reference);
      document.fonts.delete(old);
      return { family, actual, expected, oldWidth };
    },
    { bytes: [...bytes], path },
  );
  expect(measurement.family).toMatch(/^preview-font-/);
  expect(measurement.actual).toBeCloseTo(measurement.expected, 4);
  console.log('Font measurement', measurement);
  await page.getByLabel('字体预览文本', { exact: true }).fill('Preview 123');
  await expect(page.locator('.font-size-text').first()).toHaveText('Preview 123');
  await expect(page.locator('.font-size-text').last()).toHaveText('Preview 123');
  await expect(page.locator('.font-glyphs span')).toHaveCount(0);
  await page.locator('.font-glyph-details summary').click();
  await expect(page.locator('.font-glyphs span')).toHaveCount(256);
  await page.locator('.font-glyph-details summary').click();
  await page
    .getByLabel('字体预览文本', { exact: true })
    .fill('Innovation in China 中国智造，慧及全球 0123456789');
  await page.screenshot({ path: 'test-results/font-system-style.png' });
  await page
    .locator('input[type=file]')
    .setInputFiles({
      name: 'next.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('Next preview'),
    });
  await expect(page.locator('.code-scroll')).toContainText('Next preview');
  expect(
    await page.evaluate(
      () => [...document.fonts].filter((face) => face.family.startsWith('preview-font-')).length,
    ),
  ).toBe(0);
  console.log(
    'Native path font binding, metadata, seven sizes, editing, lazy glyph grid and face cleanup passed.',
  );
} finally {
  await browser.close();
  await new Promise((r) => server.httpServer.close(r));
}
