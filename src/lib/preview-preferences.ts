import { defaultReadingWidths } from './reading-width';
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
  readingWidth: number;
  textWidth: number;
  codeWidth: number;
  tabs: boolean;
};
export function parsePreviewPreferences(raw: string | null): PreviewPreferences {
  let value: Partial<PreviewPreferences> = {};
  try {
    value = JSON.parse(raw || '{}') || {};
  } catch {
    /* Use defaults for damaged settings. */
  }
  const width = (value: unknown, fallback: number) =>
    typeof value === 'number' &&
    Number.isInteger(value) &&
    (value === 0 || (value >= 320 && value <= 1600))
      ? value
      : fallback;
  return {
    readingWidth: width(value.readingWidth, defaultReadingWidths.reading),
    textWidth: width(value.textWidth, defaultReadingWidths.text),
    codeWidth: width(value.codeWidth, defaultReadingWidths.code),
    tabs: value.tabs === true,
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
