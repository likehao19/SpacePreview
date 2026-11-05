import { expect, it } from 'vitest';
import { parsePreviewPreferences } from './preview-preferences';
it('restores shared reading preferences from storage', () => {
  const preferences = {
    font: 'mono',
    size: 22,
    wrap: false,
    encoding: 'gb18030',
    html: 'web',
    maxPreviewMiB: 256,
    maxArchiveEntryMiB: 256,
    tabs: false,
    readingWidth: 860,
  };
  expect(parsePreviewPreferences(JSON.stringify(preferences))).toEqual(preferences);
});
it('falls back safely for corrupt and invalid persisted preferences', () => {
  const defaults = parsePreviewPreferences(null);
  expect(parsePreviewPreferences('{broken')).toEqual(defaults);
  expect(parsePreviewPreferences('null')).toEqual(defaults);
  expect(
    parsePreviewPreferences(
      JSON.stringify({ font: 'bad', size: 999, encoding: 'bad', html: 'bad' }),
    ),
  ).toEqual(defaults);
});

it('defaults to 512 MiB and rejects unsafe limits', () => {
  expect(parsePreviewPreferences(null).maxPreviewMiB).toBe(512);
  expect(parsePreviewPreferences('{"maxPreviewMiB":64}').maxPreviewMiB).toBe(64);
  for (const value of [0, -1, 4096, 16.5, '256'])
    expect(parsePreviewPreferences(JSON.stringify({ maxPreviewMiB: value })).maxPreviewMiB).toBe(
      512,
    );
});
it('restores bounded reading widths and only enables tabs explicitly', () => {
  expect(parsePreviewPreferences('{"tabs":true,"readingWidth":1080}')).toMatchObject({
    tabs: true,
    readingWidth: 1080,
  });
  for (const readingWidth of [0, 359, 2401, 860.5, '1080', null]) {
    expect(parsePreviewPreferences(JSON.stringify({ tabs: 'true', readingWidth }))).toMatchObject({
      tabs: false,
      readingWidth: 860,
    });
  }
});

it('persists independent file and archive limits', () => {
  expect(parsePreviewPreferences('{"maxPreviewMiB":2048,"maxArchiveEntryMiB":128}')).toMatchObject({
    maxPreviewMiB: 2048,
    maxArchiveEntryMiB: 128,
  });
  for (const value of [0, -1, 2048, 32.5, '128'])
    expect(
      parsePreviewPreferences(JSON.stringify({ maxArchiveEntryMiB: value })).maxArchiveEntryMiB,
    ).toBe(256);
});

it('allows archive limits up to 1 GiB without changing the 256 MiB default', () => {
  expect(parsePreviewPreferences(null).maxArchiveEntryMiB).toBe(256);
  for (const limit of [512, 1024])
    expect(
      parsePreviewPreferences(JSON.stringify({ maxArchiveEntryMiB: limit })).maxArchiveEntryMiB,
    ).toBe(limit);
});
