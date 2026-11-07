import { gzipSync } from 'node:zlib';
import { readdir, readFile, mkdir, copyFile, rename, writeFile } from 'node:fs/promises';
import { resolve, relative, dirname, join, extname } from 'node:path';
const root = resolve('example'),
  backup = resolve('test-results/example-originals');
await mkdir(backup, { recursive: true });
const walk = async (dir) =>
  (
    await Promise.all(
      (await readdir(dir, { withFileTypes: true })).map((e) =>
        e.isDirectory() ? walk(join(dir, e.name)) : join(dir, e.name),
      ),
    )
  ).flat();
const records = [];
const save = async (file, reason) => {
  const rel = relative(root, file);
  if (rel.startsWith('..')) throw new Error('Outside example');
  const target = join(backup, rel);
  await mkdir(dirname(target), { recursive: true });
  try {
    await readFile(target);
  } catch {
    await copyFile(file, target);
  }
  records.push({ file: rel, reason });
};
const fixtures = resolve('test-results/fixtures');
const replacements = {
  '3ds': 'sample.3ds',
  blend: 'sample.blend',
  brep: 'sample.brep',
  fbx: 'sample.fbx',
  iges: 'sample.iges',
  igs: 'sample.iges',
  step: 'sample.step',
  stp: 'sample.step',
  cr2: 'camera.cr2',
  kdc: 'camera.kdc',
  cur: 'sample.cur',
  heic: 'sample.heic',
  heif: 'sample.heic',
  msg: 'sample.msg',
  wmf: 'sample.wmf',
  emf: 'sample.emf',
  '7z': 'archive.7z',
  cb7: 'archive.7z',
  rar: 'sample-rar5.rar',
  cbr: 'sample-rar5.rar',
  lz: 'archive.lz',
  webm: '../demo-output/门店经营演示.webm',
  '3mf': 'sample.3mf',
  dxf: '../demo-output/咖啡门店平面图.dxf',
  epub: '阅读时光.epub',
  lzma: 'archive.lzma',
};
const toReplace = new Set([
  'step',
  'stp',
  '7z',
  'cb7',
  'rar',
  'cbr',
  'wmf',
  'emf',
  '3mf',
  'dxf',
  'epub',
  'lzma',
  'svgz',
]);
for (const file of await walk(root)) {
  const bytes = await readFile(file),
    ext = extname(file).slice(1).toLowerCase();
  const placeholder =
    bytes.length < 500 && bytes.toString().startsWith('这个扩展名没有可用的最小真实文件');
  const wrongZip =
    ['iso', 'ddeb', '7z', 'rar', 'cb7', 'cbr'].includes(ext) &&
    bytes.subarray(0, 2).toString() === 'PK';
  if (!placeholder && !wrongZip && !toReplace.has(ext)) continue;
  await save(
    file,
    placeholder
      ? '文字占位，非真实格式'
      : wrongZip
        ? '扩展名与 ZIP 数据不匹配'
        : '替换不完整或显示失败的样本',
  );
  const src = replacements[ext];
  if (ext === 'svgz') {
    await writeFile(file, gzipSync(await readFile(join(root, '图像/sample.svg'))));
    records.at(-1).action = '已替换为实际 gzip 压缩 SVG';
  } else if (src) {
    await copyFile(join(fixtures, src), file);
    records.at(-1).action = '已换成真实样本';
  } else if (ext === 'ico' || ext === 'icns') {
    await copyFile(resolve(`src-tauri/icons/icon.${ext}`), file);
    records.at(-1).action = '已换成应用真实图标';
  } else {
    // Preserve invalid originals outside the demo folder; never keep text disguised as binary.
    const target = join(backup, 'removed', relative(root, file));
    await mkdir(dirname(target), { recursive: true });
    await rename(file, target);
    records.at(-1).action = '原件移至测试备份，待补真实样本';
  }
}
for (const name of [
  'pr2-real.stl',
  'Cerberus.obj',
  'assembly.stp',
  'large-200k.stl',
  'AC1015.dwg',
  'AC1021.dwg',
  'AC1032.dwg',
]) {
  const target = join(root, '三维与图纸', name);
  await copyFile(join(fixtures, name), target);
}
let previous = [];
try {
  previous = JSON.parse(await readFile(join(backup, 'repair-report.json'), 'utf8'));
} catch {}
const merged = [...new Map([...previous, ...records].map((r) => [r.file, r])).values()];
await writeFile(join(backup, 'repair-report.json'), JSON.stringify(merged, null, 2));
await writeFile(
  join(root, '待补充格式.md'),
  '# 待补充真实样本\n\n以下文件原来是文字占位或格式不匹配，已将原件备份到 `test-results/example-originals`，不再作为可用预览演示。缺少样本不等于软件不支持该格式。\n\n' +
    merged
      .filter((r) => r.action.includes('待补'))
      .map((r) => `- ${r.file}：${r.reason}`)
      .join('\n') +
    '\n',
);
console.log(
  'Checked',
  records.length,
  'problem files; replaced',
  records.filter((r) => r.action.startsWith('已换')).length,
  '; moved invalid originals',
  records.filter((r) => r.action.includes('待补')).length,
);
