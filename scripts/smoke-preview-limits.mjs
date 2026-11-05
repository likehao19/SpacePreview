import { chromium, expect } from '@playwright/test';
import { zipSync } from 'fflate';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://127.0.0.1:1434');
  const settings = async () => {
    await page.getByTitle('更多选项', { exact: true }).click();
    await page.getByRole('button', { name: '偏好设置', exact: true }).click();
    await page
      .getByRole('navigation', { name: '设置分类' })
      .getByRole('button', { name: '预览', exact: true })
      .click();
  };
  await settings();
  const single = page.getByLabel('文件预览大小上限', { exact: true });
  const archive = page.getByLabel('压缩包内文件大小上限', { exact: true });
  await expect(single).toHaveValue('512');
  await expect(archive).toHaveValue('256');
  await single.selectOption('2048');
  await archive.selectOption('16');
  await page.reload();
  await settings();
  await expect(single).toHaveValue('2048');
  await expect(archive).toHaveValue('16');
  const zip = Buffer.from(
    zipSync({ 'large.bin': new Uint8Array(33 * 1024 * 1024).fill(0) }, { level: 0 }),
  );
  const open = () =>
    page
      .locator('input[type=file]')
      .setInputFiles({ name: 'limits.zip', mimeType: 'application/zip', buffer: zip });
  await open();
  await expect(page.getByRole('button', { name: 'large.bin', exact: true })).toBeDisabled();
  await settings();
  await archive.selectOption('64');
  await page.getByRole('button', { name: '返回预览', exact: true }).click();
  await expect(page.getByRole('button', { name: 'large.bin', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'large.bin', exact: true }).click();
  await expect(page.getByLabel('十六进制文件内容')).toBeVisible({ timeout: 30000 });
  await settings();
  await archive.selectOption('16');
  await page.getByRole('button', { name: '返回预览', exact: true }).click();
  await expect(page.getByRole('button', { name: 'large.bin', exact: true })).toBeDisabled();
  await expect(page.getByLabel('十六进制文件内容')).toHaveCount(0);
  await settings();
  await archive.selectOption('64');
  await single.selectOption('16');
  await page.getByRole('button', { name: '返回预览', exact: true }).click();
  await expect(page.getByText('文件超过预览上限', { exact: false })).toBeVisible();
  await settings();
  await single.selectOption('2048');
  await archive.selectOption('256');
  const expanded = Buffer.from(zipSync({ 'above-default.bin': new Uint8Array(257 * 1024 * 1024) }));
  await page
    .locator('input[type=file]')
    .setInputFiles({ name: 'expanded.zip', mimeType: 'application/zip', buffer: expanded });
  await expect(page.getByRole('button', { name: 'above-default.bin', exact: true })).toBeDisabled();
  await settings();
  await archive.selectOption('1024');
  await page.getByRole('button', { name: '返回预览', exact: true }).click();
  await expect(page.getByRole('button', { name: 'above-default.bin', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'above-default.bin', exact: true }).click();
  await expect(page.getByLabel('十六进制文件内容')).toBeVisible({ timeout: 30000 });
  await settings();
  await archive.selectOption('256');
  await page.getByRole('button', { name: '返回预览', exact: true }).click();
  await expect(page.getByRole('button', { name: 'above-default.bin', exact: true })).toBeDisabled();
  await expect(page.getByLabel('十六进制文件内容')).toHaveCount(0);
  expect(errors).toEqual([]);
  console.log(
    'Defaults, persistence, live archive limit changes, 33 MiB stored entry extraction, lower-limit cleanup, global limit and 257 MiB expansion with 1 GiB setting passed.',
  );
} finally {
  await browser.close();
}
