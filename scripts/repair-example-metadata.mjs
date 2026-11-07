import { readFile, writeFile, readdir, mkdir, copyFile, rename } from 'node:fs/promises';
import { join, extname, dirname } from 'node:path';
import { officeVariant } from './example-office-variant.mjs';
const changes = [];
for (const dir of ['文档与电子书', '表格', '演示文稿'])
  for (const file of await readdir('example/' + dir)) {
    const path = join('example', dir, file),
      bytes = await readFile(path),
      fixed = officeVariant(bytes, extname(file).slice(1));
    if (fixed === bytes) continue;
    const backup = join('test-results/example-originals/office-metadata', dir, file);
    await mkdir(dirname(backup), { recursive: true });
    await copyFile(path, backup);
    await writeFile(path, fixed);
    changes.push({ file: path, action: '修正 Office 主内容类型' });
  }
const zipOnly = [
  'apk',
  'ipa',
  'whl',
  'nupkg',
  'snupkg',
  'vsix',
  'xpi',
  'aab',
  'hap',
  'wgt',
  'wgtu',
  'qlplugin',
  'appx',
  'appxbundle',
  'msix',
  'msixbundle',
  'pyz',
  'egg',
];
for (const ext of [...zipOnly, 'msi', 'msp', 'deb']) {
  const old = `example/压缩包与容器/sample.${ext}`,
    target = `example/压缩包与容器/结构演示-${ext}.${zipOnly.includes(ext) ? 'zip' : ['msi', 'msp'].includes(ext) ? 'cfb' : 'ar'}`;
  try {
    await rename(old, target);
    changes.push({ file: old, action: `更名为 ${target}，不再冒充完整安装包` });
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
}
let previous = [];
try {
  previous = JSON.parse(await readFile('test-results/example-deep-repairs.json', 'utf8'));
} catch {}
const merged = [...new Map([...previous, ...changes].map((row) => [row.file, row])).values()];
await writeFile('test-results/example-deep-repairs.json', JSON.stringify(merged, null, 2));
console.log('Fixed', changes.length, 'files');
