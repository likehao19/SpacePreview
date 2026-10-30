import { expect, it } from 'vitest';
import { previewTabs, emptyTabs, type TabState } from './preview-tabs';
import type { PreviewFile } from './files';
const file = (name: string, id = name): PreviewFile => ({
  id,
  name,
  path: `/tmp/${name}`,
  size: 20,
  mime: 'text/plain',
  modified: 1,
});
const open = (state: TabState, name: string, keep = true, replace = false) =>
  previewTabs(state, { type: 'open', file: file(name), mode: 'auto', source: 1, keep, replace });
it('deduplicates reopened paths even when file identity changes', () => {
  let state = open(emptyTabs, 'a');
  state = previewTabs(state, { type: 'mode', value: 'text' });
  state = open(state, 'b');
  state = previewTabs(state, {
    type: 'open',
    file: file('a', 'new-id'),
    mode: 'auto',
    source: 2,
    keep: true,
  });
  expect(state.items).toHaveLength(2);
  expect(state.active).toBe('/tmp/a');
  expect(state.items[0].mode).toBe('text');
  expect(state.items[0].source).toBe(2);
});
it('navigation replaces the active tab, including an already open target', () => {
  let state = open(open(emptyTabs, 'a'), 'b');
  state = open(state, 'a', true, true);
  expect(state.items.map((tab) => tab.file.name)).toEqual(['a']);
  expect(state.active).toBe('/tmp/a');
});
it('closing a background tab preserves the active one and closing active selects a neighbor', () => {
  const state = open(open(open(emptyTabs, 'a'), 'b'), 'c');
  const background = previewTabs(state, { type: 'close', key: '/tmp/a' });
  expect(background.active).toBe('/tmp/c');
  const active = previewTabs(background, { type: 'close', key: '/tmp/c' });
  expect(active.active).toBe('/tmp/b');
  expect(previewTabs(active, { type: 'close', key: '/tmp/b' })).toEqual(emptyTabs);
});
it('single-file mode replaces sessions and leaving an archive releases decompressed entries', () => {
  let state = open(emptyTabs, 'archive.zip');
  state = previewTabs(state, {
    type: 'archive',
    value: [{ ...file('inside'), blob: new Blob(['preview']) }],
  });
  state = open(state, 'b');
  expect(state.items[0].archive).toEqual([]);
  expect(open(state, 'c', false).items.map((tab) => tab.file.name)).toEqual(['c']);
  expect(previewTabs(state, { type: 'clear' })).toEqual(emptyTabs);
});
