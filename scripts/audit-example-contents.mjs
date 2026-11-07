import { preview } from 'vite';
import { chromium, expect } from '@playwright/test';
import { readdir, writeFile } from 'node:fs/promises';
const server = await preview({ preview: { port: 1435, host: '127.0.0.1' } }),
  browser = await chromium.launch({ channel: 'msedge', headless: true });
const report = [];
try {
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:1435');
  const reset = async () => {
    await page
      .locator('input[type=file]')
      .setInputFiles({ name: 'reset.txt', mimeType: 'text/plain', buffer: Buffer.from('Reset') });
    await expect(page.locator('.code-scroll')).toContainText('Reset');
  };
  for (const name of await readdir('example/压缩包与容器')) {
    await reset();
    await page.locator('input[type=file]').setInputFiles('example/压缩包与容器/' + name);
    await expect(page.locator('.directory-tree').first()).toBeVisible({ timeout: 20000 });
    for (let i = 0; i < 12; i++) {
      const closed = page
        .locator('.directory-tree')
        .first()
        .locator('[role=treeitem][aria-expanded=false] > button:not(:disabled)');
      if (!(await closed.count())) break;
      await closed.first().click();
    }
    const leaves = page
      .locator('.directory-tree')
      .first()
      .locator('[role=treeitem]:not([aria-expanded]) > button:not(:disabled)');
    const count = Math.min(await leaves.count(), 3);
    if (!count) {
      report.push({ name, status: 'no-previewable-entry' });
      continue;
    }
    for (let i = 0; i < count; i++) {
      await leaves.nth(i).click();
      const content = page.locator('.directory-content').first();
      await expect(content.locator('.directory-file-heading')).toBeVisible({ timeout: 15000 });
      await expect
        .poll(
          async () => {
            const error = content.locator('[role=alert]');
            if (await error.count()) throw new Error(await error.first().innerText());
            return content
              .locator(
                '.code-scroll,.prose,.preview-image,.hex-grid,.tiff-preview canvas,.workbook-table',
              )
              .count();
          },
          { timeout: 15000 },
        )
        .toBeGreaterThan(0);
    }
    report.push({ name, status: 'ok', opened: count });
    console.log('archive', name, count);
  }
  for (const name of await readdir('example/音视频')) {
    await reset();
    await page.locator('input[type=file]').setInputFiles('example/音视频/' + name);
    const media = page.locator('audio,video');
    await expect
      .poll(() => media.evaluate((el) => el.readyState), { timeout: 15000 })
      .toBeGreaterThanOrEqual(2);
    await media.evaluate(async (el) => {
      el.muted = true;
      await el.play();
    });
    await page.waitForTimeout(250);
    expect(await media.evaluate((el) => el.currentTime)).toBeGreaterThan(0);
    await media.evaluate((el) => {
      el.currentTime = el.duration / 2;
      el.pause();
    });
    await reset();
    report.push({ name, status: 'media-play-and-seek-ok' });
  }
  await writeFile('test-results/example-deep-audit.json', JSON.stringify(report, null, 2));
  console.log('Deep checks', report.length);
} finally {
  await browser.close();
  await new Promise((r) => server.httpServer.close(r));
}
