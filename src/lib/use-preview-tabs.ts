import { useCallback, useEffect, useState, type SetStateAction } from 'react';
import type { PreviewFile } from './files';
import {
  openPreviewTabs,
  closePreviewTab,
  type PreviewMode,
  type PreviewTabs,
} from './preview-tabs';
import { newSessionCache } from '../components/PreviewSession';

export function usePreviewTabs(enabled: boolean) {
  const [state, setState] = useState<PreviewTabs>({ tabs: [], active: null });
  const active = state.tabs.find((tab) => tab.id === state.active);
  useEffect(() => {
    if (!enabled)
      setState((current) => ({
        tabs: current.tabs.filter((tab) => tab.id === current.active),
        active: current.active,
      }));
  }, [enabled]);
  const openFiles = useCallback(
    (files: PreviewFile[], mode: PreviewMode, replace = false, source: number | null = null) => {
      setState((current) => openPreviewTabs(current, files, mode, enabled, replace, source));
    },
    [enabled],
  );
  const clear = useCallback(() => setState({ tabs: [], active: null }), []);
  const setMode = useCallback(
    (value: SetStateAction<PreviewMode>) =>
      setState((current) => ({
        ...current,
        tabs: current.tabs.map((tab) =>
          tab.id === current.active
            ? { ...tab, mode: typeof value === 'function' ? value(tab.mode) : value }
            : tab,
        ),
      })),
    [],
  );
  const setArchiveStack = useCallback(
    (value: SetStateAction<PreviewFile[]>) =>
      setState((current) => ({
        ...current,
        tabs: current.tabs.map((tab) =>
          tab.id === current.active
            ? {
                ...tab,
                archiveStack: typeof value === 'function' ? value(tab.archiveStack) : value,
              }
            : tab,
        ),
      })),
    [],
  );
  const select = (id: string) =>
    setState((current) =>
      current.tabs.some((tab) => tab.id === id) ? { ...current, active: id } : current,
    );
  const close = (id: string) => setState((current) => closePreviewTab(current, id));
  const view = (id: string) => {
    if (!active) throw new Error('No active preview tab');
    let cache = active.views.get(id);
    if (!cache) {
      cache = newSessionCache();
      active.views.set(id, cache);
    }
    return cache;
  };
  return {
    tabs: state.tabs,
    activeId: state.active,
    source: active?.source,
    files: active ? [active.file] : [],
    mode: active?.mode ?? 'auto',
    archiveStack: active?.archiveStack ?? [],
    openFiles,
    clear,
    setMode,
    setArchiveStack,
    select,
    close,
    view,
  };
}
