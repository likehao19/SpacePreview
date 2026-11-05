import { proxy, wrap, type Remote } from 'comlink';
import { readFullBytes } from './bridge';
import { extension, type PreviewFile } from './files';
import type { ArchiveEntry } from './worker-types';
import { parseInWorker } from './worker-client';
import { openPackage, packageFormats } from './package-session';
import { isTar } from './compressed-stream';

interface NativeEntry {
  path: string;
  type: string;
  size: number;
  fileData?: Uint8Array;
}
interface ArchiveClient {
  open(file: File, ready: () => void): void;
  listFiles(): NativeEntry[];
  extractSingleFile(path: string): NativeEntry;
  usePassword(password: string): void;
}

// Read raw directory entries: the library's object API drops empty directories
// and treats filenames as object properties. Paths here remain display-only strings.
export async function openArchive(
  file: PreviewFile,
  signal: AbortSignal,
  password = '',
  entryLimit = 256 * 1024 * 1024,
) {
  if (packageFormats.includes(extension(file.name))) return openPackage(file, signal);
  if (['gz', 'zst', 'zstd', 'bz2', 'xz'].includes(extension(file.name))) {
    const bytes = await readFullBytes(file, signal);
    const result = await parseInWorker(
      { kind: 'archive-decompress', name: file.name, bytes, archiveEntryLimit: entryLimit },
      signal,
    );
    const data = result.data!;
    // A compression stream may contain either a TAR archive or a single file.
    // libarchive's default format set does not include raw single-file streams.
    const tar = isTar(data) || /\.tar\.(?:gz|zstd?|bz2|xz)$/i.test(file.name);
    if (tar) {
      const blob = new Blob([data as Uint8Array<ArrayBuffer>]);
      return openArchive(
        {
          ...file,
          path: undefined,
          blob,
          size: blob.size,
          name: file.name.replace(/\.(?:gz|zstd?|bz2|xz)$/i, '') + '.tar',
        },
        signal,
        password,
        entryLimit,
      );
    }
    const name = file.name.replace(/\.(?:gz|zstd?|bz2|xz)$/i, '');
    const entry: ArchiveEntry = {
      name,
      size: data.length,
      compressed: file.size,
      directory: false,
      index: 0,
      sourcePath: name,
    };
    return {
      entries: [entry],
      close: () => {},
      extract: async (_entry: ArchiveEntry, limit = 256 * 1024 * 1024) => {
        if (data.length > limit || file.size > limit) throw new Error('内部文件超过设置上限。');
        return new Blob([data as Uint8Array<ArrayBuffer>]);
      },
    };
  }
  const worker = new Worker(new URL('/engines/archive-worker.js', location.href), {
    type: 'module',
  });
  let fail: (error: Error) => void = () => {};
  const stopped = new Promise<never>((_, reject) => {
    fail = reject;
  });
  void stopped.catch(() => {});
  const close = (error: Error = new DOMException('已取消', 'AbortError')) => {
    clearTimeout(timer);
    signal.removeEventListener('abort', abort);
    worker.terminate();
    fail(error);
  };
  const abort = () => close();
  const timer = setTimeout(() => {
    close(new Error('压缩包读取超过 120 秒，已停止。'));
  }, 120_000);
  worker.onerror = () => {
    close(new Error('压缩包引擎加载失败。'));
  };
  signal.addEventListener('abort', abort, { once: true });
  const call = <T>(value: Promise<T>) => Promise.race([value, stopped]);
  try {
    if (signal.aborted) throw new DOMException('已取消', 'AbortError');
    const Constructor = wrap<new (ready: () => void) => ArchiveClient>(worker);
    let ready: () => void = () => {};
    const initialized = new Promise<void>((resolve) => {
      ready = resolve;
    });
    const client: Remote<ArchiveClient> = await call(new Constructor(proxy(ready)));
    await call(initialized);
    const bytes =
      file.blob ?? new Blob([(await readFullBytes(file, signal)) as Uint8Array<ArrayBuffer>]);
    let opened: () => void = () => {};
    const loaded = new Promise<void>((resolve) => {
      opened = resolve;
    });
    await call(client.open(new File([bytes], file.name), proxy(opened)));
    await call(loaded);
    if (password) await call(client.usePassword(password));
    const nativeEntries = await call(client.listFiles());
    if (nativeEntries.length > 100_000) throw new Error('压缩包包含超过 100,000 个条目。');
    const entries: ArchiveEntry[] = nativeEntries
      .filter((entry) => entry.type === 'FILE' || entry.type === 'DIR')
      .map((entry, index) => ({
        name: entry.path.replace(/\\/g, '/').replace(/\/$/, '') + (entry.type === 'DIR' ? '/' : ''),
        directory: entry.type === 'DIR',
        size: entry.size,
        compressed: -1,
        index,
        sourcePath: entry.path,
      }));
    clearTimeout(timer);
    return {
      entries,
      close,
      async extract(entry: ArchiveEntry, limit = 256 * 1024 * 1024) {
        if (entry.size > limit) throw new Error('内部文件超过设置上限。');
        const extractionTimer = setTimeout(
          () => close(new Error('内部文件解压超过 120 秒，已停止。')),
          120_000,
        );
        try {
          const result = await call(client.extractSingleFile(entry.sourcePath!));
          if (!result?.fileData || result.fileData.byteLength !== entry.size)
            throw new Error('内部文件读取失败，可能已损坏或需要密码。');
          return new Blob([result.fileData as Uint8Array<ArrayBuffer>]);
        } finally {
          clearTimeout(extractionTimer);
        }
      },
    };
  } catch (error) {
    close();
    throw error;
  }
}
