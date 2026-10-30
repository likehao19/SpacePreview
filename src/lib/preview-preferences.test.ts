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

it('defaults to 256 MiB and rejects unsafe limits', () => {
  expect(parsePreviewPreferences(null).maxPreviewMiB).toBe(256);
  expect(parsePreviewPreferences('{"maxPreviewMiB":64}').maxPreviewMiB).toBe(64);
  for (const value of [0, -1, 2048, 16.5, '256'])
    expect(parsePreviewPreferences(JSON.stringify({ maxPreviewMiB: value })).maxPreviewMiB).toBe(
      256,
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
