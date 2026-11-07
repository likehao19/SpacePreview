import { chromium, expect } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { containerFixtures } from './container-fixtures.mjs';
import { createServer } from 'vite';

// 核对官网每个明确列出的后缀是否有路由；这一步不计作内容解析通过。
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
  const { detectKind } = await vite.ssrLoadModule('/src/lib/files.ts');
  const html = await readFile(new URL('../website/index.html', import.meta.url), 'utf8');
  const table = html.match(/<tbody>([\s\S]*?)<\/tbody>/)[1];
  for (const [, cell] of table.matchAll(/<td>([\s\S]*?)<\/td>/g)) {
    for (const extension of cell
      .replace(/<[^>]*>/g, '')
      .match(/[A-Za-z0-9]+(?:\.[A-Za-z0-9]+)*/g) ?? []) {
      // ZIP64 是 ZIP 容器能力；其余两个是引擎/产品名，并非文件后缀。
      if (['ZIP64', 'Graphviz', 'Chromium'].includes(extension)) continue;
      expect(
        detectKind(`audit.${extension.toLowerCase()}`),
        `未接入官网格式：${extension}`,
      ).not.toBe('binary');
    }
  }
  expect(detectKind('sample.raw')).toBe('binary');
  console.log('Advertised extension routes PASS (not a compatibility guarantee)');
} finally {
  await vite.close();
}

// 在生产构建服务上验证实际内容；扩展名注册本身不能证明解析成功。
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const passed = [];
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const csp = JSON.parse(await readFile(new URL('../src-tauri/tauri.conf.json', import.meta.url)))
    .app.security.csp;
  await page.route('**/', async (route) => {
    if (route.request().resourceType() !== 'document') return route.continue();
    const response = await route.fetch();
    await route.fulfill({
      response,
      headers: { ...response.headers(), 'content-security-policy': csp },
    });
  });
  await page.goto(process.env.UI_TEST_URL || 'http://127.0.0.1:1423');
  const open = async (name, buffer) => {
    await page
      .locator('input[type=file]')
      .setInputFiles(
        buffer
          ? { name, mimeType: 'application/octet-stream', buffer: Buffer.from(buffer) }
          : fileURLToPath(new URL(`../test-results/fixtures/${name}`, import.meta.url)),
      );
    await expect(page.locator('.file-title strong')).toHaveText(name);
  };
  const expandFolders = async () => {
    const folders = page.locator('[role="treeitem"][aria-expanded="false"] > button');
    while (await folders.count()) await folders.first().click();
  };
  const pass = (name) => {
    passed.push(name);
    console.log(name, 'PASS');
  };
  for (const name of [
    'archive.tar',
    'archive.tgz',
    'archive.bz2',
    'archive.xz',
    'archive.lz',
    'archive.7z',
    'sample.rar',
    'sample-rar5.rar',
    'archive.zst',
    'archive.lzma',
    'hello.txt.gz',
    'hello.txt.bz2',
    'hello.txt.xz',
  ]) {
    await open(name);
    await expect(page.getByRole('tree', { name: '压缩包目录' })).toBeVisible({ timeout: 30000 });
    await expandFolders();
    const file = page
      .locator('[role="treeitem"]:not([aria-expanded]) > button:not(:disabled)')
      .first();
    await expect(file).toBeVisible();
    await file.click();
    await expect(page.locator('.directory-file-preview')).toBeVisible();
    if (name === 'sample-rar5.rar') {
      // 官方 RAR5 样本仅含二进制 .bin，提取后应能查看真实字节。
      await page.getByRole('button', { name: '查看文件信息', exact: true }).click();
      await expect(page.getByLabel('十六进制文件内容')).toBeVisible();
      pass(name + ' (binary entry extracted)');
      continue;
    }
    await expect(page.locator('.directory-file-preview .code-scroll')).toBeVisible({
      timeout: 30000,
    });
    expect(
      (await page.locator('.directory-file-preview .code-scroll').innerText()).length,
    ).toBeGreaterThan(0);
    pass(name);
  }
  const fixtures = await containerFixtures();
  for (const name of Object.keys(fixtures).filter((name) =>
    /\.(asar|crx|cfb|eif|msi|msp|pak|aab|appx|appxbundle|msix|msixbundle|hap|wgt|wgtu|qlplugin|ar|cpio|xar)$/.test(
      name,
    ),
  )) {
    await open(name, fixtures[name]);
    await expect(page.getByRole('tree', { name: '压缩包目录' })).toBeVisible({ timeout: 30000 });
    await expandFolders();
    await page
      .getByRole('tree')
      .getByRole('button', { name: /hello\.txt|resource-100\.dat/ })
      .click();
    await expect(page.locator('.directory-file-preview .code-scroll')).toContainText(
      '容器里面的中文内容',
    );
    pass(name);
  }
  for (const ext of [
    'kra',
    'sketch',
    'xd',
    'xmind',
    'fig',
    'cdr',
    'pix',
    'pip',
    'pdn',
    'icns',
    'ani',
    'svgz',
  ]) {
    await open(`sample.${ext}`, fixtures[`sample.${ext}`]);
    await expect(page.locator('.preview-image')).toBeVisible({ timeout: 30000 });
    expect(
      await page.locator('.preview-image').evaluate((image) => image.naturalWidth),
    ).toBeGreaterThan(0);
    pass(`sample.${ext} (structure sample)`);
  }
  await open('sample.sqlite');
  await page.getByRole('button', { name: '中文表 表', exact: true }).click();
  await expect(page.locator('.database-grid')).toContainText('记录 200');
  pass('SQLite');
  await open('sample.ttf');
  await expect(page.getByLabel('字体预览文本')).toBeVisible();
  await page.locator('.font-glyph-details summary').click();
  await expect(page.locator('.font-glyphs span').first()).toBeVisible();
  pass('TTF');
  await open('sample.ttc', fixtures['sample.ttc']);
  await expect(page.locator('.font-paper h1')).toContainText('Liberation Sans');
  pass('TTC (structure sample)');
  for (const ext of ['wmf', 'emf']) {
    await open(`sample.${ext}`);
    await expect(page.locator('.metafile-preview .preview-image')).toBeVisible({ timeout: 30000 });
    pass(ext);
  }
  await open('sample.eml');
  await expect(page.frameLocator('iframe').locator('h1')).toHaveText('中文邮件正文');
  pass('EML');
  await open('sample.msg');
  await expect(page.locator('.mail-header')).toContainText('Hello');
  pass('MSG');
  await open('sample.mhtml', fixtures['sample.mhtml']);
  await expect(page.frameLocator('iframe').locator('h1')).toHaveText('完整网页存档');
  pass('MHTML (structure sample)');
  expect(errors).toEqual([]);
} finally {
  await writeFile(
    new URL('../test-results/format-audit.json', import.meta.url),
    JSON.stringify({ passed }, null, 2),
  );
  await browser.close();
}
