import { zipSync } from 'fflate';
import { readRange } from './bridge';
import { readZipDirectory, readZipEntry } from './zip-range';
import { parseInWorker } from './worker-client';
import type { PreviewFile } from './files';
import type { WorkerResult } from './worker-types';

export async function readStructuredInStages(
  file: PreviewFile,
  kind: 'xlsx' | 'pptx' | 'epub',
  signal: AbortSignal,
  publish: (result: WorkerResult) => void,
  progress: (percent: number) => void,
) {
  const read = async (offset: number, length: number) => {
    signal.throwIfAborted();
    const bytes = await readRange(file, offset, length);
    signal.throwIfAborted();
    return bytes;
  };
  const directory = await readZipDirectory(file.size, read);
  const listed = await parseInWorker(
    { kind: 'archive-directory', name: file.name, ...directory },
    signal,
  );
  const entries = listed.entries!;
  const metadata =
    kind === 'xlsx'
      ? [
          'xl/workbook.xml',
          'xl/_rels/workbook.xml.rels',
          'xl/styles.xml',
          'xl/sharedStrings.xml',
          'xl/theme/theme1.xml',
        ]
      : kind === 'pptx'
        ? ['ppt/presentation.xml', 'ppt/_rels/presentation.xml.rels']
        : ['META-INF/container.xml'];
  let expanded = 0;
  const load = async (name: string, required: boolean) => {
    const entry = entries.find((entry) => entry.name === name && !entry.directory);
    if (!entry) {
      if (required) throw new Error(`文档缺少内容：${name}`);
      return undefined;
    }
    // Keep the existing expanded-XML bounds even when loading separate units.
    if (entry.size > 12 * 1024 * 1024 || expanded + entry.size > 48 * 1024 * 1024)
      throw new Error('文档展开内容超过预览上限，已保留加载完成的内容。');
    expanded += entry.size;
    const bytes = await readZipEntry(entry, file.size, read);
    const result = await parseInWorker(
      { kind: 'archive-data', name: file.name, bytes, entry },
      signal,
    );
    return result.data!;
  };
  const base: Record<string, Uint8Array> = Object.create(null);
  for (const name of metadata) {
    const bytes = await load(name, false);
    if (bytes) base[name] = bytes;
  }
  if (kind === 'epub') {
    const manifest = await parseInWorker(
      { kind, phase: 'package', name: file.name, bytes: zipSync(base, { level: 0 }) },
      signal,
    );
    const path = manifest.units![0].path;
    base[path] = (await load(path, true))!;
  }
  const index = await parseInWorker(
    { kind, phase: 'index', name: file.name, bytes: zipSync(base, { level: 0 }) },
    signal,
  );
  const result: WorkerResult =
    kind === 'xlsx' ? { sheets: [] } : kind === 'pptx' ? { slides: [] } : { chapters: [] };
  for (let unit = 0; unit < index.units!.length; unit++) {
    const path = index.units![unit].path;
    const bytes = base[path] ?? (await load(path, true));
    const value = await parseInWorker(
      { kind, unit, name: file.name, bytes: zipSync({ ...base, [path]: bytes! }, { level: 0 }) },
      signal,
    );
    signal.throwIfAborted();
    if (value.sheets) result.sheets = [...result.sheets!, ...value.sheets];
    if (value.slides) result.slides = [...result.slides!, ...value.slides];
    if (value.chapters) result.chapters = [...result.chapters!, ...value.chapters];
    publish({ ...result });
    progress(Math.round(((unit + 1) / index.units!.length) * 100));
    await new Promise((resolve) => setTimeout(resolve, 16));
  }
  if (!index.units!.length) publish(result);
}
