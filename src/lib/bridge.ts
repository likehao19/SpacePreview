import { convertFileSrc, invoke, isTauri } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import type { PreviewFile } from './files';
import { readWholeFile } from './full-read';

export const desktop = isTauri();
const iconCache = new Map<string, Promise<string | undefined>>();
export function systemFileIcon(
  name: string,
  path?: string,
  folder = false,
): Promise<string | undefined> {
  if (!desktop) return Promise.resolve(undefined);
  const key = path
    ? `path:${path}`
    : folder
      ? 'folder'
      : `type:${name.split('.').at(-1)?.toLowerCase()}`;
  let pending = iconCache.get(key);
  if (!pending) {
    pending = invoke<ArrayBuffer>('file_icon', { path: path ?? null, name, folder })
      .then((data) => {
        const bytes = new Uint8Array(data);
        return bytes.length
          ? `data:image/png;base64,${btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(''))}`
          : undefined;
      })
      .catch(() => undefined);
    if (iconCache.size >= 256) iconCache.delete(iconCache.keys().next().value!);
    iconCache.set(key, pending);
  }
  return pending;
}
export async function pickNativeFiles(): Promise<PreviewFile[]> {
  const paths = await open({ multiple: false, directory: false });
  if (!paths) return [];
  return Promise.all((Array.isArray(paths) ? paths : [paths]).map(inspectPath));
}
export async function inspectPath(path: string): Promise<PreviewFile> {
  return invoke<PreviewFile>('inspect_file', { path });
}
export interface DirectoryPage {
  entries: PreviewFile[];
  nextOffset: number | null;
}
export function listDirectory(file: PreviewFile, offset = 0): Promise<DirectoryPage> {
  return invoke('list_directory', { path: file.path, offset });
}
export async function renderPresentation(file: PreviewFile): Promise<PreviewFile> {
  return invoke<PreviewFile>('render_presentation', { path: file.path });
}
export async function readBytes(file: PreviewFile, limit: number): Promise<Uint8Array> {
  if (file.blob) return new Uint8Array(await file.blob.slice(0, limit).arrayBuffer());
  return new Uint8Array(await invoke<ArrayBuffer>('read_prefix', { path: file.path, limit }));
}
export function readFullBytes(
  file: PreviewFile,
  signal: AbortSignal,
  progress?: (percent: number) => void,
) {
  return readWholeFile(
    file.size,
    (offset, length) => readRange(file, offset, length),
    signal,
    progress,
  );
}
export async function readRange(
  file: PreviewFile,
  offset: number,
  limit: number,
): Promise<Uint8Array> {
  if (
    !Number.isSafeInteger(offset) ||
    offset < 0 ||
    !Number.isSafeInteger(limit) ||
    limit < 0 ||
    limit > 32 * 1024 * 1024
  )
    throw new Error('文件读取范围无效。');
  if (file.blob) return new Uint8Array(await file.blob.slice(offset, offset + limit).arrayBuffer());
  return new Uint8Array(
    await invoke<ArrayBuffer>('read_range', { path: file.path, offset, limit }),
  );
}
export function fileUrl(file: PreviewFile): { url: string; dispose: () => void } {
  if (file.blob) {
    const url = URL.createObjectURL(file.blob);
    return { url, dispose: () => URL.revokeObjectURL(url) };
  }
  const url = convertFileSrc(file.path!);
  return {
    url: file.revision ? `${url}?v=${encodeURIComponent(file.revision)}` : url,
    dispose: () => {},
  };
}
export async function openDefault(file: PreviewFile) {
  if (file.path) await invoke('open_default', { path: file.path });
}
