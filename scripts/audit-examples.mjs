import { preview, createServer } from 'vite';
import { chromium, expect } from '@playwright/test';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve, relative } from 'node:path';
const ssr = await createServer({ server: { middlewareMode: true } });
const { detectKind } = await ssr.ssrLoadModule('/src/lib/files.ts');
await ssr.close();
const walk = async (dir) =>
  (
    await Promise.all(
      (await readdir(dir, { withFileTypes: true })).map((e) =>
        e.isDirectory() ? walk(join(dir, e.name)) : join(dir, e.name),
      ),
    )
  ).flat();
const files = await walk(resolve('example'));
const server = await preview({ preview: { host: '127.0.0.1', port: 1435 } });
const browser = await chromium.launch({
  channel: 'msedge',
  headless: true,
  args: ['--enable-unsafe-swiftshader'],
});
const report = [];
try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
  await page.goto('http://127.0.0.1:1435');
  for (const file of files) {
    const name = relative(resolve('example'), file),
      kind = detectKind(file);
    if (/\.(dwg|dwt|dws)$/i.test(file)) {
      report.push({
        name,
        kind,
        status: 'native-only',
        note: 'Real DWGs verified by smoke-cad-model-real.mjs',
      });
      continue;
    }
    await page
      .locator('input[type=file]')
      .setInputFiles({
        name: 'audit-reset.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('Audit reset'),
      });
    await expect(page.locator('.code-scroll')).toContainText('Audit reset');
    await page.locator('input[type=file]').setInputFiles(file);
    await expect(page.locator('.file-title strong')).toHaveText(file.split(/[\\/]/).pop());
    let status = 'timeout',
      note = '';
    const start = Date.now();
    while (Date.now() - start < 20000) {
      const state = await page.evaluate(() => {
        const alert = [...document.querySelectorAll('[role=alert]')]
          .filter((e) => e.getClientRects().length)
          .map((e) => e.textContent)
          .join(' ');
        if (alert) return { status: 'failed', note: alert };
        const message = [...document.querySelectorAll('.preview-message')]
          .filter(
            (e) =>
              e.getClientRects().length &&
              !e.querySelector('.spinner') &&
              !/正在|加载中|在左侧展开/.test(e.textContent),
          )
          .map((e) => e.textContent)
          .join(' ');
        if (message) return { status: 'failed', note: message };
        const media = document.querySelector('audio,video');
        if (media) {
          if (media.error) return { status: 'failed', note: '媒体解码失败' };
          if (media.readyState >= 2) return { status: 'ok' };
          return {};
        }
        const image = document.querySelector('.image-preview img');
        if (image) return image.complete && image.naturalWidth ? { status: 'ok' } : {};
        if (
          document.querySelector(
            '.model-loading,.animation-preview .spinner,.font-preview .spinner',
          )
        )
          return {};
        const content = document.querySelector(
          '.code-scroll,.prose,.workbook-table,.slide-paper,.font-paper,.database-grid,.directory-tree,.hex-grid,.cad-canvas,.diagram-scroll svg,.animation-canvas svg,.model-canvas canvas,.pdf-page canvas,.ofd-canvas svg,.mail-text,.tiff-preview canvas',
        );
        if (content && content.getClientRects().length)
          return { status: 'ok', hex: content.classList.contains('hex-grid') };
        const frame = document.querySelector('iframe');
        if (frame?.contentDocument?.body?.textContent?.trim()) return { status: 'ok' };
        return {};
      });
      if (state.status) {
        status = state.status;
        note = state.note || '';
        if (state.hex && kind !== 'binary') {
          status = 'failed';
          note = '只显示十六进制，未进入声明的格式预览';
        }
        break;
      }
      await page.waitForTimeout(75);
    }
    report.push({ name, kind, status, note });
    if (status !== 'ok') console.log(status, name, note.slice(0, 160));
    if (report.length % 25 === 0) {
      console.log('checked', report.length, '/', files.length);
      await writeFile('test-results/example-audit.json', JSON.stringify(report, null, 2));
    }
  }
  await writeFile('test-results/example-audit.json', JSON.stringify(report, null, 2));
  console.log(
    'RESULT',
    report.reduce((r, x) => ((r[x.status] = (r[x.status] || 0) + 1), r), {}),
  );
} finally {
  await browser.close();
  await new Promise((r) => server.httpServer.close(r));
}
