import { chromium, expect } from '@playwright/test';
import { zipSync, strToU8 } from 'fflate';
import fs from 'node:fs';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const url = process.env.UI_TEST_URL || 'http://127.0.0.1:1424';
try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const csp = JSON.parse(fs.readFileSync('src-tauri/tauri.conf.json', 'utf8')).app.security.csp;
  await page.route(url + '/', async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      headers: { ...response.headers(), 'content-security-policy': csp },
    });
  });
  await page.addInitScript(() => {
    const read = Blob.prototype.arrayBuffer;
    window.holdSize = 196608;
    window.blocked = false;
    Blob.prototype.arrayBuffer = async function () {
      if (this.size === window.holdSize) {
        window.blocked = true;
        await new Promise((resolve, reject) => {
          window.resume = resolve;
          window.failRead = () => reject(new Error('模拟后续读取失败'));
        });
      }
      return read.call(this);
    };
  });
  await page.goto(url);
  const cdp = await page.context().newCDPSession(page);
  const open = (name, buffer) =>
    page
      .locator('input[type=file]')
      .setInputFiles({ name, buffer: Buffer.from(buffer), mimeType: 'application/octet-stream' });
  const waitBlocked = () => expect.poll(() => page.evaluate(() => window.blocked)).toBe(true);
  const reset = async (size = 196608) => {
    await page.locator('input[type=file]').setInputFiles({
      name: 'between.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('Between fixtures'),
    });
    await expect(page.locator('.code-scroll')).toContainText('Between fixtures');
    await cdp.send('HeapProfiler.collectGarbage');
    await page.evaluate((size) => {
      window.holdSize = size;
      window.blocked = false;
    }, size);
  };
  const resume = () =>
    page.evaluate(() => {
      window.holdSize = 0;
      window.resume();
    });
  for (const [name, text, first, selector] of [
    [
      'large.txt',
      'FIRST_TEXT\n' + ('中文正文'.repeat(20) + '\n').repeat(8000) + 'LAST_TEXT',
      'FIRST_TEXT',
      '.code-scroll',
    ],
    [
      'large.ts',
      '// FIRST_CODE\n' +
        ('const value = "' + '中文'.repeat(50) + '";\n').repeat(6000) +
        '// LAST_CODE',
      'FIRST_CODE',
      '.code-scroll',
    ],
    [
      'large.md',
      '# FIRST_MARKDOWN\n\n' + ('正文段落。'.repeat(60) + '\n\n').repeat(3000) + '# LAST_MARKDOWN',
      'FIRST_MARKDOWN',
      '.document-paper',
    ],
    [
      'large.csv',
      'name,note\nFIRST_CSV,完整\nsecond,"' +
        ('多行'.repeat(120) + '\n').repeat(2000) +
        '"\nLAST_CSV,结束',
      'FIRST_CSV',
      '.workbook-table',
    ],
  ]) {
    console.log('Progressive case', name);
    await reset();
    await open(name, Buffer.from(text));
    await waitBlocked();
    await expect(page.locator(selector)).toContainText(first);
    await expect(page.locator('.preview-loading-toast')).toContainText('后续内容加载中');
    if (name.endsWith('csv')) await expect(page.locator('.workbook-table tbody tr')).toHaveCount(2);
    await page.screenshot({ path: `test-results/progressive-${name.split('.').at(-1)}.png` });
    await resume();
    await expect(page.locator('.preview-loading-toast')).toHaveCount(0, { timeout: 30000 });
    await expect(page.locator(selector)).toContainText(
      name.endsWith('csv')
        ? 'LAST_CSV'
        : name.endsWith('md')
          ? 'LAST_MARKDOWN'
          : name.endsWith('ts')
            ? 'LAST_CODE'
            : 'LAST_TEXT',
    );
  }
  await reset();
  await open(
    'retain.txt',
    Buffer.from('KEEP_PREFIX\n' + ('content'.repeat(30) + '\n').repeat(4000)),
  );
  await waitBlocked();
  await page.evaluate(() => window.failRead());
  await expect(page.locator('.progressive-status')).toContainText('模拟后续读取失败');
  await expect(page.locator('.code-scroll')).toContainText('KEEP_PREFIX');
  await page.evaluate(() => {
    window.holdSize = 0;
    window.blocked = false;
  });
  await page.getByRole('button', { name: '重新加载' }).click();
  await expect(page.locator('.preview-loading-toast')).toHaveCount(0, { timeout: 30000 });

  await reset(0);
  await open(
    'large.html',
    Buffer.from(
      '<html><head><style>h1{color:rgb(12,34,56)}</style></head><body><h1>FIRST_HTML</h1><script>window.unsafeRan=true</script>' +
        ('<p>' + '网页正文内容'.repeat(100) + '</p>').repeat(2000) +
        '<h2>LAST_HTML</h2></body></html>',
    ),
  );
  await expect(page.locator('.code-scroll')).toContainText('FIRST_HTML');
  await page.getByTitle('更多选项', { exact: true }).click();
  await page.getByRole('button', { name: '偏好设置', exact: true }).click();
  await page
    .getByRole('navigation', { name: '设置分类' })
    .getByRole('button', { name: '预览', exact: true })
    .click();
  await page.evaluate(() => {
    window.holdSize = 196608;
    window.blocked = false;
  });
  await page.getByLabel('HTML 默认视图').selectOption('web');
  await page.getByRole('button', { name: '返回预览', exact: true }).click();
  await waitBlocked();
  const webpage = page.frameLocator('iframe[title="HTML 网页预览"]');
  await expect(webpage.getByRole('heading', { name: 'FIRST_HTML' })).toHaveCSS(
    'color',
    'rgb(12, 34, 56)',
  );
  await expect(webpage.locator('script')).toHaveCount(0);
  await webpage.locator('body').evaluate(() => window.scrollTo(0, 800));
  await resume();
  await expect(page.locator('.preview-loading-toast')).toHaveCount(0, { timeout: 30000 });
  await expect(webpage.locator('body')).toContainText('LAST_HTML');
  expect(await webpage.locator('body').evaluate(() => window.scrollY)).toBeGreaterThan(0);

  const pack = (parts) =>
    zipSync(
      {
        ...Object.fromEntries(Object.entries(parts).map(([name, value]) => [name, strToU8(value)])),
        'unused.bin': new Uint8Array(2 * 1024 * 1024),
      },
      { level: 0 },
    );
  const padded = (value) => value + ' '.repeat(140001 - Buffer.byteLength(value));
  const fixtures = [
    [
      'book.xlsx',
      pack({
        'xl/workbook.xml':
          '<workbook xmlns:r="r"><sheets><sheet name="第一表" r:id="a"/><sheet name="第二表" r:id="b"/></sheets></workbook>',
        'xl/_rels/workbook.xml.rels':
          '<Relationships><Relationship Id="a" Target="worksheets/first.xml"/><Relationship Id="b" Target="worksheets/second.xml"/></Relationships>',
        'xl/worksheets/first.xml':
          '<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>FIRST_SHEET</t></is></c></row></sheetData></worksheet>',
        'xl/worksheets/second.xml': padded(
          '<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>SECOND_SHEET</t></is></c></row></sheetData></worksheet>',
        ),
      }),
      'FIRST_SHEET',
      'SECOND_SHEET',
    ],
    [
      'book.epub',
      pack({
        'META-INF/container.xml':
          '<container><rootfiles><rootfile full-path="OPS/book.manifest"/></rootfiles></container>',
        'OPS/book.manifest':
          '<package><manifest><item id="one" href="one.xhtml" media-type="application/xhtml+xml"/><item id="two" href="two.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="one"/><itemref idref="two"/></spine></package>',
        'OPS/one.xhtml': '<html><body><h1>FIRST_CHAPTER</h1><p>正文</p></body></html>',
        'OPS/two.xhtml': padded('<html><body><h1>SECOND_CHAPTER</h1><p>后续正文</p></body></html>'),
      }),
      'FIRST_CHAPTER',
      'SECOND_CHAPTER',
    ],
    [
      'slides.pptx',
      pack({
        'ppt/presentation.xml':
          '<presentation xmlns:r="r"><sldIdLst><sldId r:id="a"/><sldId r:id="b"/></sldIdLst></presentation>',
        'ppt/_rels/presentation.xml.rels':
          '<Relationships><Relationship Id="a" Target="slides/first.xml"/><Relationship Id="b" Target="slides/second.xml"/></Relationships>',
        'ppt/slides/first.xml':
          '<sld><cSld><spTree><sp><txBody><p><r><t>FIRST_SLIDE</t></r></p></txBody></sp></spTree></cSld></sld>',
        'ppt/slides/second.xml': padded(
          '<sld><cSld><spTree><sp><txBody><p><r><t>SECOND_SLIDE</t></r></p></txBody></sp></spTree></cSld></sld>',
        ),
      }),
      'FIRST_SLIDE',
      'SECOND_SLIDE',
    ],
  ];
  for (const [name, buffer, first, last] of fixtures) {
    await reset(140001);
    await open(name, buffer);
    await waitBlocked();
    await expect(page.locator('main')).toContainText(first);
    await expect(page.locator('main')).not.toContainText(last);
    await resume();
    await expect(page.locator('.preview-loading-toast')).toHaveCount(0, { timeout: 30000 });
    if (name.endsWith('xlsx')) await page.getByRole('tab', { name: '第二表' }).click();
    else if (name.endsWith('epub')) {
      await page.getByTitle('更多选项', { exact: true }).click();
      await page.getByLabel('选择电子书章节').selectOption('1');
      await page.getByLabel('关闭更多选项').click({ position: { x: 10, y: 100 } });
    } else {
      await page.getByTitle('更多选项', { exact: true }).click();
      await page.getByTitle('下一张幻灯片').click();
      await page.getByLabel('关闭更多选项').click({ position: { x: 10, y: 100 } });
    }
    await expect(page.locator('main')).toContainText(last);
  }
  expect(errors).toEqual([]);
  console.log(
    'Passed: large text/code/Markdown/CSV prefixes before later reads, final tail content, CSV partial-row safety, retained prefix on failure/retry, staged Excel sheets/EPUB chapters/PPT text slides under production CSP.',
  );
} finally {
  await browser.close();
}
