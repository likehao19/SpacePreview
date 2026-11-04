import { chromium, expect } from '@playwright/test';
import { zipSync, strToU8 } from 'fflate';

const longName = 'long-filename-for-horizontal-scrolling-and-complete-display-example.txt';
const archivePath = `deep/nested/${longName}`;
const content = strToU8('Sidebar preview content');
const zip = zipSync({ [archivePath]: content });
const header = new Uint8Array(512);
const field = (offset, length, text) => header.set(strToU8(text).slice(0, length), offset);
field(0, 100, archivePath);
field(100, 8, '0000644');
field(124, 12, content.length.toString(8).padStart(11, '0'));
field(148, 8, '        ');
field(156, 1, '0');
field(257, 6, 'ustar');
field(263, 2, '00');
field(
  148,
  8,
  [...header]
    .reduce((sum, byte) => sum + byte, 0)
    .toString(8)
    .padStart(6, '0') + '\0 ',
);
const tar = new Uint8Array(2048);
tar.set(header);
tar.set(content, 512);

const browser = await chromium.launch({
  channel: 'msedge',
  headless: true,
  ignoreDefaultArgs: ['--hide-scrollbars'],
});
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  await page.addInitScript(() =>
    localStorage.setItem('preview-preferences', JSON.stringify({ tabs: true })),
  );
  await page.goto(process.env.UI_TEST_URL || 'http://127.0.0.1:1420', {
    waitUntil: 'domcontentloaded',
  });
  const resizeAndScroll = async (target) => {
    const sidebar = target.locator('.directory-sidebar').first();
    const handle = target.getByRole('separator', { name: '调整文件目录宽度' }).first();
    const tree = sidebar.locator('.directory-tree');
    await expect(handle).toBeVisible();
    const before = await sidebar.boundingBox();
    const grip = await handle.boundingBox();
    await target.mouse.move(grip.x + 4, grip.y + 60);
    await target.mouse.down();
    await target.mouse.move(grip.x + 104, grip.y + 60);
    await target.mouse.up();
    expect((await sidebar.boundingBox()).width).toBeCloseTo(before.width + 100, 0);
    expect(await tree.evaluate((node) => getComputedStyle(node).overflowX)).toBe('auto');
    expect(await tree.evaluate((node) => node.scrollWidth > node.clientWidth)).toBe(true);
    const bounds = await tree.boundingBox();
    await target.mouse.click(bounds.x + bounds.width - 35, bounds.y + bounds.height - 4);
    await expect.poll(() => tree.evaluate((node) => node.scrollLeft)).toBeGreaterThan(0);
    await handle.focus();
    await target.keyboard.press('Home');
    expect((await sidebar.boundingBox()).width).toBe(150);
    await target.keyboard.press('End');
    expect((await sidebar.boundingBox()).width).toBe(640);
    await target.setViewportSize({ width: 640, height: 600 });
    expect((await sidebar.boundingBox()).width).toBeLessThanOrEqual(352);
    expect(
      (await target.locator('.directory-content').first().boundingBox()).width,
    ).toBeGreaterThan(200);
    await target.setViewportSize({ width: 1200, height: 800 });
  };
  for (const extension of ['zip', 'jar', 'tar']) {
    await page
      .locator('input[type=file]')
      .setInputFiles({
        name: `sidebar.${extension}`,
        mimeType: 'application/octet-stream',
        buffer: Buffer.from(extension === 'tar' ? tar : zip),
      });
    await page.getByRole('button', { name: 'deep', exact: true }).click();
    await page.getByRole('button', { name: 'nested', exact: true }).click();
    await resizeAndScroll(page);
    await page.getByRole('button', { name: longName, exact: true }).click();
    await expect(page.locator('.code-scroll')).toContainText('Sidebar preview content');
  }
  await page.getByRole('tab', { name: 'sidebar.zip', exact: true }).click();
  expect((await page.locator('.directory-sidebar').first().boundingBox()).width).toBe(640);

  const folder = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  await folder.addInitScript((longName) => {
    window.isTauri = true;
    window.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener() {} };
    window.__TAURI_INTERNALS__ = {
      metadata: { currentWindow: { label: 'main' }, currentWebview: { label: 'main' } },
      transformCallback() {
        return 1;
      },
      unregisterCallback() {},
      async invoke(command) {
        if (command === 'initial_paths') return { paths: ['C:/sidebar-folder'], text: false };
        if (command === 'inspect_file')
          return {
            id: 'folder',
            path: 'C:/sidebar-folder',
            name: 'sidebar-folder',
            size: 0,
            modified: 1,
            directory: true,
          };
        if (command === 'list_directory')
          return {
            entries: [
              {
                id: 'file',
                path: `C:/sidebar-folder/${longName}`,
                name: longName,
                size: 20,
                modified: 1,
                directory: false,
              },
            ],
            nextOffset: null,
          };
        if (command === 'agent_status')
          return { platform: 'windows', supported: true, running: true, enabled: true };
        if (command === 'file_icon') return new ArrayBuffer(0);
        if (command === 'plugin:window|current_monitor') return null;
      },
    };
  }, longName);
  await folder.goto(process.env.UI_TEST_URL || 'http://127.0.0.1:1420', {
    waitUntil: 'domcontentloaded',
  });
  await expect(folder.getByRole('button', { name: longName, exact: true })).toBeVisible();
  await resizeAndScroll(folder);
  console.log(
    'ZIP/JAR/TAR and folder sidebar drag, keyboard sizing, horizontal scrollbar, narrow-window bounds, tab width restoration and entry preview passed.',
  );
} finally {
  await browser.close();
}
