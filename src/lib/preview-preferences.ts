import type { TextEncoding } from './files';

export const textEncodings = [
  'auto',
  'utf-8',
  'utf-16le',
  'utf-16be',
  'gb18030',
  'big5',
  'windows-1252',
  'shift_jis',
] as const;
export type PreviewPreferences = {
  font: 'auto' | 'sans' | 'serif' | 'mono';
  size: number;
  wrap: boolean;
  encoding: TextEncoding;
  html: 'source' | 'web';
  maxPreviewMiB: number;
  tabs: boolean;
  readingWidth: number;
};
export function parsePreviewPreferences(raw: string | null): PreviewPreferences {
  let value: Partial<PreviewPreferences> = {};
  try {
    value = JSON.parse(raw || '{}') || {};
  } catch {
    /* Use defaults for damaged settings. */
  }
  return {
    tabs: value.tabs === true,
    readingWidth:
      Number.isInteger(value.readingWidth) &&
      value.readingWidth! >= 360 &&
      value.readingWidth! <= 2400
        ? value.readingWidth!
        : 860,
    maxPreviewMiB:
      Number.isInteger(value.maxPreviewMiB) &&
      value.maxPreviewMiB! >= 16 &&
      value.maxPreviewMiB! <= 1024
        ? value.maxPreviewMiB!
        : 256,
    font: ['auto', 'sans', 'serif', 'mono'].includes(value.font ?? '') ? value.font! : 'auto',
    size:
      typeof value.size === 'number' &&
      Number.isInteger(value.size) &&
      value.size >= 10 &&
      value.size <= 40
        ? value.size
        : 16,
    wrap: value.wrap !== false,
    encoding: textEncodings.includes(value.encoding as (typeof textEncodings)[number])
      ? value.encoding!
      : 'auto',
    html: value.html === 'web' ? 'web' : 'source',
  };
}
