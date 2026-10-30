import type { PreviewFile } from './files';
import type { SessionCache } from '../components/PreviewSession';

export type PreviewMode = 'auto' | 'text' | 'info';
export interface PreviewTab {
  id: string;
  file: PreviewFile;
  mode: PreviewMode;
  source?: number | null;
  archiveStack: PreviewFile[];
  views: Map<string, SessionCache>;
}
export interface PreviewTabs {
  tabs: PreviewTab[];
  active: string | null;
}
export function tabIdentity(file: PreviewFile): string {
  return file.path ?? (file.blob ? `${file.name}:${file.size}:${file.modified}` : file.id);
}
export function openPreviewTabs(
  current: PreviewTabs,
  files: PreviewFile[],
  mode: PreviewMode,
  multiple: boolean,
  replace = false,
  source: number | null = null,
): PreviewTabs {
  if (!files.length) return current;
  const tabs = multiple ? [...current.tabs] : [];
  let active = current.active;
  for (const file of multiple && !replace ? files : files.slice(0, 1)) {
    const id = tabIdentity(file);
    const existing = tabs.find((tab) => tab.id === id);
    if (!existing) {
      if (replace) {
        const index = tabs.findIndex((tab) => tab.id === active);
        if (index >= 0) {
          tabs.splice(index, 1, { id, file, mode, source, archiveStack: [], views: new Map() });
          active = id;
          continue;
        }
      }
      tabs.push({ id, file, mode, source, archiveStack: [], views: new Map() });
    } else if (existing.file.modified !== file.modified || existing.file.size !== file.size) {
      tabs[tabs.indexOf(existing)] = { id, file, mode, source, archiveStack: [], views: new Map() };
    } else if (mode === 'text') {
      tabs[tabs.indexOf(existing)] = { ...existing, mode, source };
    } else {
      tabs[tabs.indexOf(existing)] = { ...existing, source };
    }
    active = id;
  }
  return { tabs, active };
}
export function closePreviewTab(current: PreviewTabs, id: string): PreviewTabs {
  const index = current.tabs.findIndex((tab) => tab.id === id);
  if (index < 0) return current;
  const tabs = current.tabs.filter((tab) => tab.id !== id);
  return {
    tabs,
    active:
      current.active === id ? (tabs[Math.min(index, tabs.length - 1)]?.id ?? null) : current.active,
  };
}
