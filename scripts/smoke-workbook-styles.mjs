import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { zipSync, strToU8 } from 'fflate';

await mkdir('test-results/fixtures', { recursive: true });
const metadata = {
  'xl/workbook.xml':
    '<workbook xmlns:r="r"><sheets><sheet name="样式预览" r:id="r1"/></sheets></workbook>',
  'xl/_rels/workbook.xml.rels':
    '<Relationships><Relationship Id="r1" Target="worksheets/sheet1.xml"/></Relationships>',
  'xl/theme/theme1.xml':
    '<a:theme xmlns:a="a"><a:themeElements><a:clrScheme><a:accent1><a:srgbClr val="4472C4"/></a:accent1></a:clrScheme></a:themeElements></a:theme>',
  'xl/styles.xml':
    '<styleSheet><numFmts><numFmt numFmtId="164" formatCode="&quot;¥&quot;#,##0.00"/></numFmts><fonts><font><name val="Calibri"/><sz val="11"/></font><font><name val="宋体"/><sz val="18"/><b/><color rgb="FFFFFFFF"/></font></fonts><fills><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="solid"><fgColor theme="4"/></patternFill></fill></fills><borders><border/><border><bottom style="thin"><color rgb="FF112233"/></bottom></border></borders><cellXfs><xf fontId="0"/><xf fontId="1" fillId="1" borderId="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="164"/></cellXfs></styleSheet>',
};
const packageBytes = (rows, merge = 'A1:C1', padding = false) =>
  zipSync(
    {
      ...Object.fromEntries(Object.entries(metadata).map(([path, xml]) => [path, strToU8(xml)])),
      'xl/worksheets/sheet1.xml': strToU8(
        `<worksheet><sheetFormatPr defaultRowHeight="24"/><cols><col min="1" max="1" width="26"/><col min="2" max="3" width="20"/></cols><sheetData>${rows}</sheetData><mergeCells><mergeCell ref="${merge}"/></mergeCells></worksheet>`,
      ),
      ...(padding ? { 'padding.bin': new Uint8Array(2 * 1024 * 1024) } : {}),
    },
    { level: 0 },
  );
const sample = packageBytes(
  '<row r="1" ht="36"><c r="A1" t="inlineStr" s="1"><is><t>Excel 原始样式预览</t></is></c></row><row r="2" ht="30"><c r="A2" t="inlineStr"><is><t>合并标题、字体与颜色</t></is></c><c r="B2" s="2"><v>1234.5</v></c><c r="C2" t="inlineStr"><is><t>可复制文字</t></is></c></row>',
);
await writeFile('test-results/fixtures/样式预览.xlsx', sample);
const largeRows = Array.from(
  { length: 5000 },
  (_, index) =>
    `<row r="${index + 1}"${index % 7 === 0 ? ' ht="36"' : ''}><c r="A${index + 1}" t="inlineStr"${index === 0 ? ' s="1"' : ''}><is><t>${index === 0 ? '跨行合并标题' : `记录 ${index + 1}`}</t></is></c><c r="C${index + 1}" s="2"><v>${index + 1}</v></c></row>`,
).join('');
const large = packageBytes(largeRows, 'A1:B1000', true);
await writeFile('test-results/fixtures/large-styled.xlsx', large);

const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 760 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(process.env.UI_TEST_URL || 'http://127.0.0.1:1420', {
    waitUntil: 'domcontentloaded',
  });
  await page.locator('input[type=file]').setInputFiles({
    name: '样式预览.xlsx',
    mimeType: 'application/octet-stream',
    buffer: Buffer.from(sample),
  });
  const table = page.locator('.workbook-styled');
  await expect(table).toBeVisible({ timeout: 30000 });
  const title = table.locator('td[data-search-row="0"][data-search-column="0"]');
  await expect(title).toHaveAttribute('colspan', '3');
  await expect(title).toHaveCSS('background-color', 'rgb(68, 114, 196)');
  await expect(title).toHaveCSS('color', 'rgb(255, 255, 255)');
  await expect(title).toHaveCSS('font-size', '24px');
  await expect(title).toHaveCSS('font-weight', '700');
  await expect(title).toHaveCSS('text-align', 'center');
  await expect(title).toHaveCSS('border-bottom-color', 'rgb(17, 34, 51)');
  await expect(table).toContainText('¥1,234.50');
  await expect(table.locator('td[data-search-row="1"][data-search-column="1"]')).toHaveCSS(
    'text-align',
    'right',
  );
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(title).toHaveCSS('background-color', 'rgb(68, 114, 196)');
  await expect(title).toHaveCSS('color', 'rgb(255, 255, 255)');
  await page.emulateMedia({ colorScheme: 'light' });
  await page.screenshot({ path: 'test-results/workbook-styled.png' });
  const scroller = page.locator('.workbook-scroll');
  const firstWidth = await table
    .locator('col')
    .nth(1)
    .evaluate((node) => node.getBoundingClientRect().width);
  expect(firstWidth).toBeCloseTo(187, 0);
  await page.locator('input[type=file]').setInputFiles({
    name: 'large-styled.xlsx',
    mimeType: 'application/octet-stream',
    buffer: Buffer.from(large),
  });
  await expect(table).toContainText('跨行合并标题', { timeout: 30000 });
  expect(await table.locator('tbody tr').count()).toBeLessThan(100);
  await scroller.evaluate((node) => {
    node.scrollTop = 19000;
  });
  await expect.poll(() => table.locator('tbody tr > th').first().textContent()).not.toBe('1');
  await expect(table).toContainText('跨行合并标题');
  expect(await table.locator('tbody tr').count()).toBeLessThan(100);
  await scroller.evaluate((node) => {
    node.scrollTop = node.scrollHeight;
  });
  await expect(table.locator('td[data-search-row="4999"]')).toContainText([
    '记录 5000',
    '',
    '¥5,000.00',
  ]);
  await page.keyboard.press('Control+f');
  const search = page.getByRole('textbox', { name: '查找当前文件' });
  {
    await search.fill('记录 4200');
    await page.keyboard.press('Enter');
    await expect(table.locator('td[data-search-row="4199"][data-search-column="0"]')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.keyboard.press('Control+=');
    await expect(table.locator('td[data-search-row="4199"][data-search-column="0"]')).toBeVisible();
    await expect(table.locator('td[data-search-row="4199"][data-search-column="0"]')).toHaveCSS(
      'font-size',
      '16.5px',
    );
  }
  await page.locator('input[type=file]').setInputFiles({
    name: 'after-close.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('Next preview'),
  });
  await expect(page.locator('.code-scroll')).toContainText('Next preview');
  await expect(table).toHaveCount(0);
  expect(errors).toEqual([]);
  console.log(
    'Excel styles, merged cells, theme colors, variable row heights, bounded rendering, final row and closing passed.',
  );
} finally {
  await browser.close();
}
