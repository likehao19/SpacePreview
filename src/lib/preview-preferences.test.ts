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
    readingWidth: 860,
    textWidth: 0,
    codeWidth: 0,
    tabs: false,
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

it('restores width and tab settings without accepting invalid persisted sizes', () => {
  const p = parsePreviewPreferences(
    '{"readingWidth":1024,"textWidth":640,"codeWidth":1280,"tabs":true}',
  );
  expect([p.readingWidth, p.textWidth, p.codeWidth, p.tabs]).toEqual([1024, 640, 1280, true]);
  for (const width of [-1, 1, 2000, '860', null])
    expect(parsePreviewPreferences(JSON.stringify({ readingWidth: width })).readingWidth).toBe(860);
});
