import { preview } from 'vite';
import { chromium, expect } from '@playwright/test';
const server = await preview({ preview: { port: 1435, host: '127.0.0.1' } }),
  browser = await chromium.launch({
    channel: 'msedge',
    headless: true,
    args: ['--enable-unsafe-swiftshader'],
  });
try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    const read = Blob.prototype.arrayBuffer;
    Blob.prototype.arrayBuffer = async function () {
      if (this.size >= 1024 * 1024) await new Promise((r) => setTimeout(r, 400));
      return read.call(this);
    };
    const Native = window.Worker;
    window.modelReleases = [];
    window.Worker = class extends Native {
      stopped = false;
      postMessage(data, transfer) {
        if (data.kind === 'model')
          window.modelReleases.push(() => {
            if (!this.stopped) {
              if (window.failModel)
                this.dispatchEvent(
                  new MessageEvent('message', { data: { error: '模拟模型解析失败' } }),
                );
              else super.postMessage(data, transfer);
            }
          });
        else super.postMessage(data, transfer);
      }
      terminate() {
        this.stopped = true;
        super.terminate();
      }
    };
  });
  await page.goto('http://127.0.0.1:1435');
  const count = 200000,
    bytes = Buffer.alloc(84 + count * 50);
  bytes.writeUInt32LE(count, 80);
  for (let i = 0; i < count; i++) {
    const x = i % 500,
      y = Math.floor(i / 500);
    [x, y, 0, x + 1, y, 0, x, y + 1, 0].forEach((v, j) =>
      bytes.writeFloatLE(v, 84 + i * 50 + 12 + j * 4),
    );
  }
  const open = () =>
    page
      .locator('input[type=file]')
      .setInputFiles({ name: 'slow.stl', mimeType: 'application/octet-stream', buffer: bytes });
  const toast = page.locator('.preview-loading-toast');
  await open();
  await expect(toast).toBeVisible();
  await expect
    .poll(async () => Number(await toast.locator('progress').getAttribute('value')))
    .toBeGreaterThan(0);
  expect(Number(await toast.locator('progress').getAttribute('value'))).toBeLessThan(100);
  const rect = await toast.boundingBox();
  expect(rect.x + rect.width).toBeGreaterThan(1070);
  expect(rect.y + rect.height).toBeGreaterThan(770);
  await page.screenshot({ path: 'test-results/loading-model-read.png' });
  await page.waitForFunction(() => window.modelReleases.length > 0);
  await expect(toast).toContainText('正在解析三维模型');
  await expect(toast.locator('progress')).not.toHaveAttribute('value');
  await page.screenshot({ path: 'test-results/loading-model-parse.png' });
  await page.evaluate(() => window.modelReleases.splice(0).forEach((release) => release()));
  await expect(page.locator('.model-canvas canvas')).toBeVisible();
  await expect(toast).toHaveCount(0);
  await open();
  await page.waitForFunction(() => window.modelReleases.length > 0);
  await expect(toast).toBeVisible();
  await page
    .locator('input[type=file]')
    .setInputFiles({
      name: 'next.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('Next preview'),
    });
  await expect(page.locator('.code-scroll')).toContainText('Next preview');
  await expect(toast).toHaveCount(0);
  await page.evaluate(() => window.modelReleases.splice(0).forEach((release) => release()));
  await expect(toast).toHaveCount(0);
  await page.evaluate(() => (window.failModel = true));
  await open();
  await page.waitForFunction(() => window.modelReleases.length > 0);
  await expect(toast).toBeVisible();
  await page.evaluate(() => window.modelReleases.splice(0).forEach((release) => release()));
  await expect(page.getByRole('alert')).toContainText('模拟模型解析失败');
  await expect(toast).toHaveCount(0);
  expect(errors).toEqual([]);
  console.log(
    'Real read percentage, indeterminate parse stage, bottom-right position, completion and switch cleanup passed.',
  );
} finally {
  await browser.close();
  await new Promise((r) => server.httpServer.close(r));
}
