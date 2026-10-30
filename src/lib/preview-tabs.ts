import type { PreviewFile } from './files';
export type PreviewMode = 'auto' | 'text' | 'info';
export type PreviewTab = {
  file: PreviewFile;
  mode: PreviewMode;
  archive: PreviewFile[];
  source: number | null;
};
export type TabState = { items: PreviewTab[]; active: string | null };
export const tabKey = (file: PreviewFile) => file.path || file.id;
export const emptyTabs: TabState = { items: [], active: null };
export type TabAction =
  | {
      type: 'open';
      file: PreviewFile;
      mode: PreviewMode;
      source: number | null;
      keep: boolean;
      replace?: boolean;
    }
  | { type: 'select'; key: string }
  | { type: 'close'; key: string }
  | { type: 'clear' }
  | { type: 'mode'; value: PreviewMode | ((mode: PreviewMode) => PreviewMode) }
  | { type: 'archive'; value: PreviewFile[] | ((files: PreviewFile[]) => PreviewFile[]) };
export function previewTabs(state: TabState, action: TabAction): TabState {
  if (action.type === 'clear') return emptyTabs;
  if (action.type === 'open') {
    const key = tabKey(action.file);
    const existing = state.items.find((item) => tabKey(item.file) === key);
    const tab: PreviewTab = {
      file:
        existing &&
        existing.file.size === action.file.size &&
        existing.file.modified === action.file.modified
          ? existing.file
          : action.file,
      mode: action.mode,
      source: action.source,
      archive: existing?.archive ?? [],
    };
    let items = action.keep ? state.items : [];
    if (action.replace)
      items = items.filter(
        (item) => tabKey(item.file) !== state.active || tabKey(item.file) === key,
      );
    items =
      existing && action.keep
        ? items.map((item) =>
            tabKey(item.file) === key
              ? { ...tab, mode: action.mode === 'text' ? 'text' : existing.mode }
              : item,
          )
        : [...items, tab];
    // Archive entries may contain large decompressed Blobs. Release them when leaving a tab.
    items = items.map((item) => (tabKey(item.file) === key ? item : { ...item, archive: [] }));
    return { items, active: key };
  }
  if (action.type === 'select') {
    if (!state.items.some((item) => tabKey(item.file) === action.key)) return state;
    return {
      active: action.key,
      items: state.items.map((item) =>
        tabKey(item.file) === action.key ? item : { ...item, archive: [] },
      ),
    };
  }
  if (action.type === 'close') {
    const index = state.items.findIndex((item) => tabKey(item.file) === action.key);
    const items = state.items.filter((item) => tabKey(item.file) !== action.key);
    return {
      items,
      active:
        state.active === action.key
          ? items[Math.min(index, items.length - 1)]
            ? tabKey(items[Math.min(index, items.length - 1)].file)
            : null
          : state.active,
    };
  }
  return {
    ...state,
    items: state.items.map((item) =>
      tabKey(item.file) !== state.active
        ? item
        : action.type === 'mode'
          ? {
              ...item,
              mode: typeof action.value === 'function' ? action.value(item.mode) : action.value,
            }
          : {
              ...item,
              archive:
                typeof action.value === 'function' ? action.value(item.archive) : action.value,
            },
    ),
  };
}
