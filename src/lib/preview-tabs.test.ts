import { describe, expect, it } from 'vitest';
import { closePreviewTab, openPreviewTabs, type PreviewTabs } from './preview-tabs';
import type { PreviewFile } from './files';

const file = (name: string, modified = 1): PreviewFile => ({
  id: name,
  path: `C:/files/${name}`,
  name,
  size: 100,
  modified,
  mime: 'text/plain',
});
const empty = (): PreviewTabs => ({ tabs: [], active: null });
describe('preview tab sessions', () => {
  it('tracks the originating file manager view for each tab and updates it on reopening', () => {
    const a = openPreviewTabs(empty(), [file('a.md')], 'auto', true, false, 1);
    const b = openPreviewTabs(a, [file('b.md')], 'auto', true, false, 2);
    expect(b.tabs.map((tab) => tab.source)).toEqual([1, 2]);
    const again = openPreviewTabs(b, [file('a.md')], 'auto', true, false, 3);
    expect(again.tabs.map((tab) => tab.source)).toEqual([3, 2]);
  });
  it('keeps the existing single-file behavior when tabs are disabled', () => {
    const a = openPreviewTabs(empty(), [file('a.md')], 'auto', false);
    const b = openPreviewTabs(a, [file('b.md'), file('c.md')], 'text', false);
    expect(b.tabs.map((tab) => tab.file.name)).toEqual(['b.md']);
    expect(b.tabs[0].mode).toBe('text');
  });
  it('deduplicates paths while keeping each existing mode, archive stack and view cache', () => {
    const a = openPreviewTabs(empty(), [file('a.md')], 'auto', true);
    a.tabs[0].mode = 'info';
    a.tabs[0].archiveStack = [file('inside.txt')];
    const views = a.tabs[0].views;
    const b = openPreviewTabs(a, [file('b.zip')], 'auto', true);
    const again = openPreviewTabs(b, [file('a.md')], 'auto', true);
    expect(again.tabs).toHaveLength(2);
    expect(again.active).toBe(a.active);
    expect(again.tabs[0].mode).toBe('info');
    expect(again.tabs[0].archiveStack[0].name).toBe('inside.txt');
    expect(again.tabs[0].views).toBe(views);
    expect(openPreviewTabs(again, [file('a.md')], 'text', true).tabs[0].mode).toBe('text');
  });
  it('file navigation replaces the active tab without accumulating tabs or moving its position', () => {
    const a = openPreviewTabs(empty(), [file('a.md'), file('b.md')], 'auto', true);
    a.active = a.tabs[0].id;
    const next = openPreviewTabs(a, [file('c.md')], 'auto', true, true);
    expect(next.tabs.map((tab) => tab.file.name)).toEqual(['c.md', 'b.md']);
    expect(next.active).toBe(next.tabs[0].id);
  });
  it('closing a background tab keeps the active tab, closing active chooses a neighbor, and last closes all', () => {
    const a = openPreviewTabs(empty(), [file('a.md'), file('b.md'), file('c.md')], 'auto', true);
    const background = closePreviewTab(a, a.tabs[0].id);
    expect(background.active).toBe(a.active);
    const closed = closePreviewTab(background, a.active!);
    expect(closed.active).toBe(background.tabs[0].id);
    expect(closePreviewTab(closed, closed.active!)).toEqual(empty());
    expect(closePreviewTab(a, 'missing')).toBe(a);
  });
  it('reopening a modified file refreshes it and discards stale view state', () => {
    const a = openPreviewTabs(empty(), [file('a.md')], 'auto', true);
    const next = openPreviewTabs(a, [file('a.md', 2)], 'auto', true);
    expect(next.tabs).toHaveLength(1);
    expect(next.tabs[0].file.modified).toBe(2);
    expect(next.tabs[0].views).not.toBe(a.tabs[0].views);
  });
});
