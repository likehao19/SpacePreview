import { chromium, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
  const csp = JSON.parse(await readFile('src-tauri/tauri.conf.json', 'utf8')).app.security.csp;
  const url = process.env.UI_TEST_URL || 'http://127.0.0.1:1434';
  await page.route(url + '/', async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      headers: { ...response.headers(), 'content-security-policy': csp },
    });
  });
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aHzkAAAAASUVORK5CYII=',
    'base64',
  );
  const requests = [];
  await page.route('https://images.example.test/**', async (route) => {
    requests.push({ url: route.request().url(), referer: route.request().headers().referer });
    await route.fulfill(
      route.request().url().includes('missing')
        ? { status: 404, body: 'Not found' }
        : { contentType: 'image/png', body: png },
    );
  });
  await page.goto(url);
  const open = (name, text) =>
    page
      .locator('input[type=file]')
      .setInputFiles({ name, mimeType: 'text/plain', buffer: Buffer.from(text) });
  await open(
    'images.md',
    '# Images\n\n![正常图片](https://images.example.test/good.png)\n\n![失效图片](https://images.example.test/missing.png)\n\n<img src="file:///C:/private.png"><img src="javascript:alert(1)" onerror="window.imageScriptRan=true"><script>window.imageScriptRan=true</script>',
  );
  const image = page.locator('.reader-image img[alt="正常图片"]');
  await expect(image).toBeVisible();
  await expect
    .poll(() => image.evaluate((node) => node.complete && node.naturalWidth > 0))
    .toBe(true);
  await expect(image).toHaveAttribute('loading', 'lazy');
  await expect(image).toHaveAttribute('referrerpolicy', 'no-referrer');
  await expect(page.locator('.reader-image-error:not([hidden])')).toContainText('失效图片加载失败');
  await expect(
    page.locator('.prose img[src^="file:"],.prose img[src^="javascript:"],.prose script'),
  ).toHaveCount(0);
  expect(await page.evaluate(() => window.imageScriptRan)).toBeUndefined();
  expect(requests.every((request) => !request.referer)).toBe(true);

  const longMarkdown =
    '# Long document\n\n' +
    Array.from(
      { length: 80 },
      (_, index) =>
        `## Section ${index}\n\n${'Paragraph of text for lazy image loading.\n\n'.repeat(15)}![Image ${index}](https://images.example.test/good.png?image=${index})\n\n`,
    ).join('');
  const before = requests.length;
  await open('long-images.md', longMarkdown);
  await expect(page.locator('.reader-image img')).toHaveCount(80);
  expect(requests.length - before).toBeLessThan(80);
  await open('next.txt', 'Next preview');
  await expect(page.locator('.code-scroll')).toContainText('Next preview');
  await expect(page.locator('.reader-image')).toHaveCount(0);
  console.log(
    'Markdown remote images, production CSP, lazy loading, no referrer, failure feedback and active-content filtering passed.',
  );
} finally {
  await browser.close();
}
