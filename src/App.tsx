import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import {
  ArrowDownToLine,
  ArrowLeft,
  Check,
  Eye,
  FileCode2,
  FolderOpen,
  Info,
  Keyboard,
  Maximize2,
  Minimize2,
  Minus,
  Square,
  Copy,
  Monitor,
  Moon,
  MoreHorizontal,
  Settings2,
  Sun,
  Upload,
  X,
  Search,
} from 'lucide-react';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/core';
import Preview from './components/Preview';
import FileSearch from './components/FileSearch';
import { usePreviewWindow } from './lib/use-preview-window';
import UnsupportedPreview from './components/UnsupportedPreview';
import UpdateSettings from './components/UpdateSettings';
import PreviewPreferencesSettings, { usePreviewPreferences } from './components/PreviewPreferences';
import PreviewSession from './components/PreviewSession';
import { usePreviewTabs } from './lib/use-preview-tabs';
import { useAppUpdate } from './lib/use-app-update';
import { version } from '../package.json';
import { PreviewMenuTarget } from './components/PreviewToolbar';
import { TextAppearanceProvider } from './components/TextAppearance';
import { desktop, inspectPath, openDefault, pickNativeFiles } from './lib/bridge';
import { detectKind, formatSize, fromBrowser, type PreviewFile } from './lib/files';
import {
  defaultShortcut,
  matchesShortcut,
  shortcutFromEvent,
  shortcutEventCode,
  shortcutLabel,
  validShortcut,
  type Shortcut,
} from './lib/shortcuts';

import {
  actionLabels,
  previewActions,
  defaultActions,
  restoreActions,
  actionFromEvent,
  actionConflict,
  actionLabel,
  matchesAction,
  sameShortcut,
  type PreviewAction,
  type ActionShortcuts,
} from './lib/action-shortcuts';
import { clipboardPath } from './lib/clipboard-path';

type Theme = 'system' | 'light' | 'dark';
type Settings = {
  theme: Theme;
  closeOnBlur: boolean;
  spaceEnabled: boolean;
  windowsShortcut: Shortcut;
  macosShortcut: Shortcut;
  windowsActions: ActionShortcuts;
  macosActions: ActionShortcuts;
};
type AgentStatus = {
  supported: boolean;
  enabled: boolean;
  running: boolean;
  platform?: 'macos';
  accessibility?: boolean;
  automation?: boolean;
  keyboard?: boolean;
  lastKeyResult?: number;
  selectionError?: string;
  qspaceInstalled?: boolean;
  qspaceAutomation?: boolean;
  qspaceRunning?: boolean;
};
const trace = (stage: string) => {
  if (desktop) void invoke('trace_preview', { stage }).catch(() => {});
};
function preventWindowButtonFocus(event: MouseEvent<HTMLButtonElement>) {
  event.preventDefault();
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
}
function savedSettings(): Settings {
  try {
    const s = JSON.parse(localStorage.getItem('space-settings') || '{}');
    return {
      theme: ['system', 'light', 'dark'].includes(s.theme) ? s.theme : 'system',
      closeOnBlur: s.closeOnBlur === true,
      spaceEnabled: s.spaceEnabled !== false,
      windowsShortcut: validShortcut(s.windowsShortcut) ? s.windowsShortcut : defaultShortcut,
      macosShortcut: validShortcut(s.macosShortcut) ? s.macosShortcut : defaultShortcut,
      windowsActions: restoreActions(
        s.windowsActions,
        false,
        validShortcut(s.windowsShortcut) ? s.windowsShortcut : defaultShortcut,
      ),
      macosActions: restoreActions(
        s.macosActions,
        true,
        validShortcut(s.macosShortcut) ? s.macosShortcut : defaultShortcut,
      ),
    };
  } catch {
    return {
      theme: 'system',
      closeOnBlur: false,
      spaceEnabled: true,
      windowsShortcut: defaultShortcut,
      macosShortcut: defaultShortcut,
      windowsActions: defaultActions(false),
      macosActions: defaultActions(true),
    };
  }
}
const settingsPages = [
  { id: 'settings', label: '通用', icon: Settings2 },
  { id: 'preview', label: '预览', icon: FileCode2 },
  { id: 'shortcuts', label: '快捷键', icon: Keyboard },
  { id: 'guide', label: '使用指南', icon: Eye },
  { id: 'about', label: '关于与更新', icon: Info },
] as const;

export default function App() {
  const updater = useAppUpdate();
  const { preferences } = usePreviewPreferences();
  const tabPreview = usePreviewTabs(preferences.tabs);
  const tabCount = useRef(0);
  tabCount.current = tabPreview.tabs.length;
  const {
    files,
    mode,
    setMode,
    archiveStack,
    setArchiveStack,
    openFiles,
    clear: clearTabs,
  } = tabPreview;
  const [settings, setSettings] = useState(savedSettings);
  const [agent, setAgent] = useState<AgentStatus | null>(null);
  const macos = agent?.platform === 'macos' || /Mac/i.test(navigator.platform);
  useEffect(() => {
    document.documentElement.dataset.platform = macos ? 'macos' : 'other';
  }, [macos]);
  const fileManager = macos ? 'Finder' : '资源管理器';
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsPage, setSettingsPage] = useState<(typeof settingsPages)[number]['id']>('guide');
  const [autostart, setAutostart] = useState<boolean | null>(null);
  const [autostartBusy, setAutostartBusy] = useState(false);
  const [recording, setRecording] = useState<
    'windowsShortcut' | 'macosShortcut' | PreviewAction | null
  >(null);
  const [shortcutError, setShortcutError] = useState('');
  const shortcut = macos ? settings.macosShortcut : settings.windowsShortcut;
  const previewKey = shortcutLabel(shortcut, macos);
  const actionSettingsKey = macos ? 'macosActions' : 'windowsActions';
  const actions = settings[actionSettingsKey];
  const [menuOpen, setMenuOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [toast, setToast] = useState('');
  const [previewError, setPreviewError] = useState('');
  const [opening, setOpening] = useState(false);
  const [suspended, setSuspended] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [menuTarget, setMenuTarget] = useState<HTMLDivElement | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const request = useRef(0);
  const initialPaths = useRef<Promise<{
    paths: string[];
    text: boolean;
    fileManager?: boolean;
  }> | null>(null);
  const initialHandled = useRef(false);
  const choosing = useRef(false);
  const navigation = useRef<{ busy: boolean } | null>(null);
  const sourceEpoch = useRef(0);
  const spaceAction = useRef<{ action: 'close' | 'text' | 'choose'; version: number } | null>(null);
  const previousArchiveDepth = useRef(0);
  const file = archiveStack.at(-1) ?? files[0];
  useEffect(() => {
    if (settingsOpen || !file) {
      navigation.current = null;
      if (desktop) void invoke('cancel_file_navigation').catch(() => {});
    }
  }, [settingsOpen, file?.id]);
  usePreviewWindow(
    desktop && macos && !opening && !suspended,
    file ? `${file.id}:${mode}:${request.current}` : '',
    settingsOpen,
    mode === 'auto' && file && !file.directory ? detectKind(file.name) : 'text',
    tabPreview.tabs.length > 1,
  );
  useEffect(() => {
    if (!desktop || (file && !settingsOpen)) return;
    let cancelled = false;
    setAutostartBusy(true);
    void invoke<boolean>('autostart_enabled')
      .then((enabled) => {
        if (!cancelled) setAutostart(enabled);
      })
      .catch((error) => {
        if (!cancelled) {
          setAutostart(null);
          setToast(`读取开机自启动状态失败：${String(error)}`);
        }
      })
      .finally(() => {
        if (!cancelled) setAutostartBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [settingsOpen, file?.id]);
  const toggleAutostart = async () => {
    if (autostart === null || autostartBusy) return;
    setAutostartBusy(true);
    try {
      setAutostart(await invoke<boolean>('set_autostart', { enabled: !autostart }));
    } catch (error) {
      setToast(`开机自启动设置失败：${String(error)}`);
    } finally {
      setAutostartBusy(false);
    }
  };
  useEffect(() => {
    if (archiveStack.length < previousArchiveDepth.current)
      document
        .querySelector<HTMLButtonElement>('.preview-layer:not([hidden]) .archive-row.selected')
        ?.focus({ preventScroll: true });
    previousArchiveDepth.current = archiveStack.length;
  }, [archiveStack.length]);
  useEffect(() => {
    if (!desktop) return;
    void invoke('set_agent_shortcut', { shortcut }).catch((error) =>
      setToast(`快捷键设置失败：${String(error)}`),
    );
    spaceAction.current = null;
  }, [shortcut]);
  useEffect(() => {
    if (!settingsOpen) {
      setRecording(null);
      setShortcutError('');
    }
  }, [settingsOpen]);
  useEffect(() => {
    if (!desktop) return;
    const window = getCurrentWindow();
    let disposed = false;
    let stop: (() => void) | undefined;
    const refresh = async () => {
      const value = await window.isMaximized();
      if (!disposed) setMaximized(value);
    };
    void refresh().catch((e) => setToast(String(e)));
    void window
      .onResized(() => void refresh().catch(() => {}))
      .then((unlisten) => {
        if (disposed) unlisten();
        else stop = unlisten;
      });
    return () => {
      disposed = true;
      stop?.();
    };
  }, []);
  const toggleMaximize = async () => {
    try {
      const window = getCurrentWindow();
      await window.toggleMaximize();
      setMaximized(await window.isMaximized());
    } catch (e) {
      setToast(`窗口调整失败：${String(e)}`);
    }
  };

  useEffect(() => {
    localStorage.setItem('space-settings', JSON.stringify(settings));
    document.documentElement.dataset.theme = settings.theme;
  }, [settings]);
  useEffect(() => {
    if (desktop && macos) {
      void getCurrentWindow()
        .setTheme(settings.theme === 'system' ? null : settings.theme)
        .catch((error) => setToast(`窗口外观同步失败：${String(error)}`));
    }
  }, [macos, settings.theme]);
  useEffect(() => {
    if (!desktop) return;
    let cancelled = false;
    const refresh = async () => {
      try {
        await invoke('set_agent_enabled', { enabled: settings.spaceEnabled });
        const current = await invoke<AgentStatus>('agent_status');
        if (!cancelled) setAgent(current);
      } catch (error) {
        if (!cancelled) setToast(`快捷键预览初始化失败：${String(error)}`);
      }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 5000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [settings.spaceEnabled]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    setMenuOpen(false);
  }, [file?.id]);

  const loadFiles = useCallback(
    (
      incoming: PreviewFile[],
      initialMode: 'auto' | 'text' = 'auto',
      replace = false,
      source: number | null = null,
    ) => {
      if (!incoming.length) return;
      request.current++;
      spaceAction.current = null;
      setOpening(false);
      setSuspended(false);
      openFiles(incoming, initialMode, replace, source);
      setPreviewError('');
      setSettingsOpen(false);
      setMenuOpen(false);
    },
    [openFiles],
  );
  const loadPaths = useCallback(
    async (paths: string[], forceText = false, navigating = false, fromFileManager = false) => {
      if (!navigating) {
        navigation.current = null;
        if (fromFileManager) sourceEpoch.current++;
        if (desktop) void invoke('cancel_file_navigation').catch(() => {});
      }
      const version = ++request.current;
      setOpening(true);
      try {
        const incoming = await Promise.all(
          (preferences.tabs && !navigating ? paths : paths.slice(0, 1)).map(inspectPath),
        );
        if (version !== request.current) return;
        loadFiles(
          incoming,
          forceText ? 'text' : 'auto',
          navigating,
          fromFileManager || navigating ? sourceEpoch.current : null,
        );
        trace('loaded');
      } catch (e) {
        trace('load-error');
        if (version === request.current) {
          if (navigating || (preferences.tabs && tabCount.current)) {
            navigation.current = null;
            setToast(`切换文件失败：${String(e)}`);
            return;
          }
          clearTabs();
          setArchiveStack([]);
          setSettingsOpen(false);
          setPreviewError(String(e));
          if (desktop && macos) {
            await getCurrentWindow().show();
            await getCurrentWindow().setFocus();
          }
        }
      } finally {
        if (version === request.current) setOpening(false);
      }
    },
    [loadFiles, macos, preferences.tabs, clearTabs],
  );

  const navigateFile = async (direction: -1 | 1) => {
    if (!desktop || !file?.path || archiveStack.length || opening) return;
    if (!tabPreview.source || tabPreview.source !== sourceEpoch.current) {
      setToast(
        `请在 ${macos ? 'Finder 或 QSpace Pro' : fileManager} 中重新选中文件后按预览快捷键，以跟随当前视图切换。`,
      );
      return;
    }
    if (navigation.current?.busy) return;
    const session = navigation.current ?? { busy: false };
    navigation.current = session;
    session.busy = true;
    const version = request.current;
    try {
      const next = await invoke<string | null>('navigate_file_selection', {
        path: file.path,
        direction,
      });
      if (navigation.current !== session || request.current !== version) return;
      if (next) await loadPaths([next], false, true);
      else setToast('当前位置没有可切换的文件');
    } catch (error) {
      if (navigation.current === session && request.current === version)
        setToast(`切换文件失败：${String(error)}`);
    } finally {
      session.busy = false;
    }
  };

  const choose = useCallback(async () => {
    if (!desktop) {
      input.current?.click();
      return;
    }
    if (choosing.current) return;
    choosing.current = true;
    try {
      const selected = await pickNativeFiles();
      if (selected.length) await loadPaths(selected.map((f) => f.path!));
    } catch (e) {
      setToast(String(e));
    } finally {
      choosing.current = false;
    }
  }, [loadPaths]);
  const closePreview = useCallback(() => {
    trace('close');
    navigation.current = null;
    request.current++;
    clearTabs();
    setPreviewError('');
    setArchiveStack([]);

    setOpening(false);
    setSuspended(false);
    if (desktop) void invoke('hide_preview').catch((error) => setToast(String(error)));
  }, [clearTabs, setArchiveStack]);
  const activateTab = (id: string) => {
    request.current++;
    navigation.current = null;
    spaceAction.current = null;
    setOpening(false);
    setPreviewError('');
    setMenuOpen(false);
    if (desktop) void invoke('cancel_file_navigation').catch(() => {});
    tabPreview.select(id);
  };
  const closeTab = (id: string) => {
    if (tabPreview.tabs.length === 1) {
      closePreview();
      return;
    }
    if (id === tabPreview.activeId) {
      request.current++;
      navigation.current = null;
      spaceAction.current = null;
      setOpening(false);
      setMenuOpen(false);
      setPreviewError('');
      if (desktop) void invoke('cancel_file_navigation').catch(() => {});
    }
    tabPreview.close(id);
  };
  const closeCurrent = () => {
    if (preferences.tabs && tabPreview.activeId) closeTab(tabPreview.activeId);
    else closePreview();
  };
  const openFile = useCallback(async () => {
    if (!file) return;
    if (!file.path) {
      setToast(
        desktop
          ? '当前预览没有本地路径，请先保存或解压到磁盘，再使用默认应用打开。'
          : '浏览器无法调用系统默认应用，请使用桌面版打开本地文件。',
      );
      return;
    }
    try {
      await openDefault(file);
    } catch (e) {
      setToast(String(e));
    }
  }, [file]);
  const copyPath = async () => {
    if (!file) return;
    try {
      await navigator.clipboard.writeText(file.path ? clipboardPath(file.path) : file.name);
      setToast(file.path ? '文件路径已复制' : '文件名已复制（当前预览没有本地路径）');
    } catch {
      setToast('剪贴板不可用，请在桌面版中重试。');
    }
    setMenuOpen(false);
  };

  useEffect(() => {
    if (!desktop || !macos) return;
    const stop = listen<string>('app-menu', ({ payload }) => {
      setMenuOpen(false);
      if (payload === 'open') void choose();
      else if (payload === 'settings' || payload === 'about' || payload === 'guide') {
        setSettingsPage(payload);
        setSettingsOpen(true);
      }
    });
    return () => {
      void stop.then((unlisten) => unlisten());
    };
  }, [macos, choose]);

  useEffect(() => {
    if (!desktop) return;
    const unlisteners: (() => void)[] = [];
    let disposed = false;
    const register = (promise: Promise<() => void>) =>
      promise.then((stop) => (disposed ? stop() : unlisteners.push(stop)));
    const filesReady = register(
      listen<{ paths: string[]; text: boolean; fileManager?: boolean }>('preview-files', (e) => {
        trace('received');
        void loadPaths(e.payload.paths, e.payload.text, false, e.payload.fileManager === true);
      }),
    );
    void register(
      listen<string>('agent-selection-error', (event) => {
        if (preferences.tabs && tabCount.current) {
          setToast(event.payload);
          return;
        }
        request.current++;
        clearTabs();
        setArchiveStack([]);
        setSettingsOpen(false);
        setOpening(false);
        setPreviewError(event.payload);
      }),
    );
    void register(
      listen('preview-closed', () => {
        trace('native-close');
        setSettingsOpen(false);
        setPreviewError('');
        request.current++;
        clearTabs();
        setArchiveStack([]);

        setOpening(false);
        setSuspended(false);
      }),
    );
    void register(
      getCurrentWindow().onDragDropEvent((event) => {
        setDragging(event.payload.type === 'over' || event.payload.type === 'enter');
        if (event.payload.type === 'drop') void loadPaths(event.payload.paths);
      }),
    );
    void filesReady
      .then(
        () =>
          (initialPaths.current ??= invoke<{
            paths: string[];
            text: boolean;
            fileManager?: boolean;
          }>('initial_paths')),
      )
      .then((initial) => {
        if (disposed || initialHandled.current) return;
        initialHandled.current = true;
        if (initial.paths.length)
          void loadPaths(initial.paths, initial.text, false, initial.fileManager === true);
      })
      .catch((error) => {
        if (!disposed) setPreviewError(`初始文件读取失败：${String(error)}`);
      });
    return () => {
      disposed = true;
      unlisteners.forEach((stop) => stop());
    };
  }, [loadPaths]);
  useEffect(() => {
    if (!desktop || !settings.closeOnBlur || settingsOpen || !file) return;
    let disposed = false;
    let stop: (() => void) | undefined;
    void getCurrentWindow()
      .onFocusChanged((e) => {
        if (e.payload && !disposed) {
          setSuspended(false);
          return;
        }
        if (!e.payload && !disposed && !choosing.current) {
          const version = request.current;
          // A queued blur from hiding the previous preview must not close a new one.
          void getCurrentWindow()
            .isFocused()
            .then((focused) => {
              if (!focused && !disposed && !choosing.current && version === request.current) {
                trace('blur-close');
                if (preferences.tabs) {
                  request.current++;
                  navigation.current = null;
                  spaceAction.current = null;
                  setOpening(false);
                  setSuspended(true);
                  void invoke('hide_preview').catch((error) => setToast(String(error)));
                } else closePreview();
              }
            })
            .catch(() => {});
        }
      })
      .then((fn) => {
        if (disposed) fn();
        else stop = fn;
      });
    return () => {
      disposed = true;
      stop?.();
    };
  }, [settings.closeOnBlur, settingsOpen, file, closePreview, preferences.tabs]);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (recording) {
        event.preventDefault();
        event.stopPropagation();
        if (event.repeat) return;
        if (event.key === 'Escape') {
          setRecording(null);
          setShortcutError('');
          return;
        }
        if (/^(Control|Alt|Meta|Shift)(Left|Right)$/.test(event.code)) return;
        if (previewActions.includes(recording as PreviewAction)) {
          const action = recording as PreviewAction;
          const next = actionFromEvent(event);
          if (!next || actionConflict(next, action, actions, shortcut)) {
            setShortcutError(
              '快捷键无效或已被占用，请选择其他组合。Esc、Space、系统菜单、编辑和检索快捷键保留。',
            );
            return;
          }
          setSettings((s) => ({
            ...s,
            [actionSettingsKey]: { ...s[actionSettingsKey], [action]: next },
          }));
          setRecording(null);
          setShortcutError('');
          return;
        }
        const next = shortcutFromEvent(event);
        if (!next) {
          setShortcutError(
            '使用字母、数字、符号、F1–F12 或 Space，可组合 Ctrl / Alt / ⌘。Shift 保留为纯文本预览；Ctrl / ⌘ + O 用于选择文件，Ctrl / ⌘ + C、加减号保留给复制和字号操作，Ctrl / ⌘ + F 用于文件检索。',
          );
          return;
        }
        const targetActions =
          recording === 'macosShortcut' ? settings.macosActions : settings.windowsActions;
        if (previewActions.some((action) => sameShortcut(next, targetActions[action]))) {
          setShortcutError('此快捷键已用于预览内操作，请选择其他组合。');
          return;
        }
        setSettings((s) => ({ ...s, [recording]: next }));
        setRecording(null);
        setShortcutError('');
        return;
      }
      if (event.code === 'Space') trace('dom-space');
      if (
        (event.ctrlKey || event.metaKey) &&
        !event.altKey &&
        !event.shiftKey &&
        event.key.toLowerCase() === 'f'
      ) {
        event.preventDefault();
        event.stopPropagation();
        if (file && !settingsOpen) {
          setMenuOpen(false);
          window.dispatchEvent(new Event('preview-find'));
        }
        return;
      }
      if (
        event.key === 'Escape' &&
        document.querySelector('.preview-layer:not([hidden]) [data-file-search]')
      ) {
        event.preventDefault();
        event.stopPropagation();
        window.dispatchEvent(new Event('preview-find-close'));
        return;
      }
      if (event.key === 'Escape' && menuOpen) {
        event.preventDefault();
        setMenuOpen(false);
        return;
      }
      if (
        event.target instanceof HTMLElement &&
        event.target.closest('input, textarea, select, [contenteditable="true"]')
      )
        return;
      if (event.key === 'Escape') {
        event.preventDefault();
        if (settingsOpen) setSettingsOpen(false);
        else closePreview();
      }
      if (
        !(desktop && macos) &&
        (event.ctrlKey || event.metaKey) &&
        !event.altKey &&
        event.key.toLowerCase() === 'o'
      ) {
        event.preventDefault();
        void choose();
      }
      if (settingsOpen || (!file && !previewError)) return;
      if (matchesShortcut(event, shortcut)) {
        event.preventDefault();
        event.stopPropagation();
        if (event.repeat) return;
        spaceAction.current = {
          action: previewError ? 'close' : file ? (event.shiftKey ? 'text' : 'close') : 'choose',
          version: request.current,
        };
        return;
      }
      if (!file) return;
      if (
        event.target instanceof Element &&
        event.target.closest('[role="tablist"], [role="separator"]')
      )
        return;
      const plainKey = !event.ctrlKey && !event.altKey && !event.metaKey && !event.shiftKey;
      if (plainKey && event.key === 'ArrowLeft' && archiveStack.length) {
        event.preventDefault();
        setArchiveStack((stack) => stack.slice(0, -1));
      }
      if (
        menuOpen ||
        (event.target instanceof HTMLElement &&
          event.target.closest(
            '[role="tree"], button, [role="slider"], input, textarea, select, [contenteditable]',
          ))
      )
        return;
      const action = previewActions.find((name) => matchesAction(event, actions[name]));
      if (action) {
        if (
          (action === 'previousFile' || action === 'nextFile') &&
          (!desktop || !file.path || archiveStack.length)
        )
          return;
        event.preventDefault();
        event.stopPropagation();
        if (event.repeat) return;
        if (action === 'copyPath') void copyPath();
        else if (action === 'openDefault') void openFile();
        else void navigateFile(action === 'previousFile' ? -1 : 1);
      }
    };
    const cancelSpace = () => {
      spaceAction.current = null;
    };
    const keyup = (event: KeyboardEvent) => {
      if (shortcutEventCode(event) !== shortcut.code) return;
      const pending = spaceAction.current;
      cancelSpace();
      if (!pending || pending.version !== request.current) return;
      event.preventDefault();
      event.stopPropagation();
      // Keep focus unchanged until the native hook has observed the release.
      if (pending.action === 'text') setMode((m) => (m === 'text' ? 'auto' : 'text'));
      else if (pending.action === 'close') closeCurrent();
      else void choose();
    };
    window.addEventListener('keydown', keydown, true);
    window.addEventListener('keyup', keyup, true);
    window.addEventListener('blur', cancelSpace);
    return () => {
      window.removeEventListener('keydown', keydown, true);
      window.removeEventListener('keyup', keyup, true);
      window.removeEventListener('blur', cancelSpace);
    };
  });

  return (
    <div
      className={`app ${file || previewError ? 'has-preview' : ''} ${desktop && macos ? 'native-mac' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (!desktop) loadFiles(Array.from(e.dataTransfer.files).map(fromBrowser));
      }}
    >
      <input
        ref={input}
        type="file"
        hidden
        onChange={(e) => {
          loadFiles(Array.from(e.target.files ?? []).map(fromBrowser));
          e.target.value = '';
        }}
      />
      <header className="titlebar" data-tauri-drag-region>
        {macos && (
          <div className="mac-window-controls">
            <button title="关闭预览 · Esc" aria-label="关闭预览" onClick={closePreview}>
              <X size={12} strokeWidth={3} />
            </button>
            {desktop && (
              <button
                title={maximized ? '恢复窗口' : '放大预览'}
                aria-label={maximized ? '恢复窗口' : '放大预览'}
                onClick={() => void toggleMaximize()}
              >
                {maximized ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
              </button>
            )}
          </div>
        )}
        <div className="title-left">
          {file && !settingsOpen ? (
            <>
              <button
                className={`app-mark mini${macos ? ' mac-home-mark' : ''}`}
                title="返回欢迎页"
                onClick={() => {
                  request.current++;
                  clearTabs();
                  setArchiveStack([]);
                }}
              >
                <img className="brand-icon" src="/app-icon.png" alt="瞬览" />
              </button>
              {archiveStack.length > 0 && (
                <button
                  className="archive-back-button"
                  title="返回列表 · ←"
                  onClick={() => setArchiveStack((stack) => stack.slice(0, -1))}
                >
                  <ArrowLeft size={15} /> 返回列表
                </button>
              )}
              <div className="file-title">
                <strong title={`${file.name} · ${formatSize(file.size)}`}>{file.name}</strong>
              </div>
            </>
          ) : (
            <>
              <div className={`app-mark mini${macos ? ' mac-home-mark' : ''}`}>
                <img className="brand-icon" src="/app-icon.png" alt="瞬览" />
              </div>
              <strong className="brand">
                {macos ? (
                  settingsOpen ? (
                    '设置'
                  ) : (
                    '瞬览'
                  )
                ) : (
                  <>
                    瞬览 <span>SpacePreview</span>
                  </>
                )}
              </strong>
            </>
          )}
        </div>
        <div className="title-right">
          {macos && file && !settingsOpen && (
            <button className="mac-open-default" onClick={() => void openFile()}>
              在默认应用中打开
            </button>
          )}
          {file && !settingsOpen && (
            <>
              <div className="menu-container">
                <button
                  className="icon-button"
                  title="更多选项"
                  aria-expanded={menuOpen}
                  onClick={() => setMenuOpen(!menuOpen)}
                >
                  <MoreHorizontal size={20} />
                </button>
                {menuOpen && (
                  <>
                    <button
                      className="menu-dismiss"
                      aria-label="关闭更多选项"
                      onClick={() => setMenuOpen(false)}
                    />
                    <div className="dropdown">
                      <div className="preview-menu-options" ref={setMenuTarget} />
                      <button
                        onClick={() => {
                          setMenuOpen(false);
                          window.dispatchEvent(new Event('preview-find'));
                        }}
                      >
                        <Search size={15} /> 文件内检索 <kbd>{macos ? '⌘' : 'Ctrl'}+F</kbd>
                      </button>
                      <button
                        onClick={() => {
                          setMenuOpen(false);
                          void choose();
                        }}
                      >
                        <FolderOpen size={15} /> 选择文件
                        <kbd>{macos ? '⌘' : 'Ctrl'}+O</kbd>
                      </button>
                      <button
                        onClick={() => {
                          setMenuOpen(false);
                          void openFile();
                        }}
                      >
                        <ArrowDownToLine size={15} /> 默认应用打开{' '}
                        <kbd>{actionLabel(actions.openDefault, macos)}</kbd>
                      </button>
                      <hr />
                      {(['auto', 'text', 'info'] as const).map((m, i) => (
                        <button
                          key={m}
                          onClick={() => {
                            setMode(m);
                            setMenuOpen(false);
                          }}
                        >
                          {[<Eye size={15} />, <FileCode2 size={15} />, <Info size={15} />][i]}
                          {['自动预览', '纯文本预览', '文件信息'][i]}
                          {mode === m && <Check size={14} />}
                        </button>
                      ))}
                      <hr />
                      <button onClick={() => void copyPath()}>
                        <ArrowDownToLine size={15} />
                        复制文件路径 <kbd>{actionLabel(actions.copyPath, macos)}</kbd>
                      </button>
                      <button
                        onClick={() => {
                          setSettingsPage('settings');
                          setSettingsOpen(true);
                          setMenuOpen(false);
                        }}
                      >
                        <Settings2 size={15} />
                        偏好设置
                      </button>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
          {!file && !settingsOpen && (
            <div className="menu-container">
              <button
                className="icon-button"
                title="更多选项"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen(!menuOpen)}
              >
                <MoreHorizontal size={20} />
              </button>
              {menuOpen && (
                <>
                  <button
                    className="menu-dismiss"
                    aria-label="关闭更多选项"
                    onClick={() => setMenuOpen(false)}
                  />
                  <div className="dropdown">
                    <button
                      onClick={() => {
                        setSettingsPage('settings');
                        setSettingsOpen(true);
                        setMenuOpen(false);
                      }}
                    >
                      <Settings2 size={15} /> 偏好设置
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
          {desktop && !macos && (
            <>
              <button
                className="icon-button"
                title="最小化"
                onMouseDown={preventWindowButtonFocus}
                onClick={() => void getCurrentWindow().minimize()}
              >
                <Minus size={18} />
              </button>
              <button
                className="icon-button"
                title={maximized ? '恢复窗口' : '最大化'}
                aria-label={maximized ? '恢复窗口' : '最大化'}
                onMouseDown={preventWindowButtonFocus}
                onClick={() => void toggleMaximize()}
              >
                {maximized ? <Copy size={15} /> : <Square size={15} />}
              </button>
            </>
          )}
          {!macos && (
            <button
              className="icon-button close-button"
              title={file || previewError ? '关闭预览 · Esc' : '隐藏窗口'}
              onMouseDown={preventWindowButtonFocus}
              onClick={closePreview}
            >
              <X size={18} />
            </button>
          )}
        </div>
      </header>

      {preferences.tabs && tabPreview.tabs.length > 1 && !settingsOpen && !suspended && (
        <div
          className="preview-tabs"
          role="tablist"
          aria-label="文件标签页"
          onKeyDown={(event) => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            event.stopPropagation();
            const focusedTab =
              event.target instanceof Element
                ? event.target.closest('.preview-tab')?.querySelector('[role="tab"]')
                : null;
            const focusedIndex = [
              ...event.currentTarget.querySelectorAll('[role="tab"]'),
            ].findIndex((node) => node === focusedTab);
            const index =
              focusedIndex >= 0
                ? focusedIndex
                : tabPreview.tabs.findIndex((tab) => tab.id === tabPreview.activeId);
            const next =
              event.key === 'Home'
                ? 0
                : event.key === 'End'
                  ? tabPreview.tabs.length - 1
                  : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabPreview.tabs.length) %
                    tabPreview.tabs.length;
            activateTab(tabPreview.tabs[next].id);
            const container = event.currentTarget;
            requestAnimationFrame(() =>
              container.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus(),
            );
          }}
        >
          {tabPreview.tabs.map((tab) => (
            <div
              className={`preview-tab ${tab.id === tabPreview.activeId ? 'active' : ''}`}
              key={tab.id}
            >
              <button
                role="tab"
                aria-selected={tab.id === tabPreview.activeId}
                aria-controls="preview-panel"
                tabIndex={tab.id === tabPreview.activeId ? 0 : -1}
                title={tab.file.path ?? tab.file.name}
                onClick={() => activateTab(tab.id)}
              >
                {tab.file.name}
              </button>
              <button
                className="tab-close"
                aria-label={`关闭标签 ${tab.file.name}`}
                onClick={() => closeTab(tab.id)}
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {previewError ? (
        <main className="preview-container">
          <UnsupportedPreview message={previewError} />
        </main>
      ) : file && !suspended ? (
        <main
          key={`${tabPreview.activeId}:${files[0]?.modified}`}
          id="preview-panel"
          role={preferences.tabs ? 'tabpanel' : undefined}
          aria-label={preferences.tabs ? files[0].name : undefined}
          className={`preview-container kind-${mode === 'auto' ? detectKind(file.name) : mode}`}
        >
          {[files[0], ...archiveStack].map((item, depth) => (
            <div className="preview-layer" hidden={depth !== archiveStack.length} key={item.id}>
              <PreviewMenuTarget.Provider value={depth === archiveStack.length ? menuTarget : null}>
                <TextAppearanceProvider
                  active={depth === archiveStack.length && !settingsOpen && !recording}
                >
                  <FileSearch active={depth === archiveStack.length && !settingsOpen && !recording}>
                    <PreviewSession cache={tabPreview.view(item.id)}>
                      <Preview
                        key={`${item.id}:${!item.directory && depth === archiveStack.length ? mode : 'auto'}`}
                        file={item}
                        mode={depth === archiveStack.length ? mode : 'auto'}
                        onOpen={(inside) => {
                          request.current++;
                          setArchiveStack((stack) => [...stack.slice(0, depth), inside]);
                          setMode('auto');
                        }}
                      />
                    </PreviewSession>
                  </FileSearch>
                </TextAppearanceProvider>
              </PreviewMenuTarget.Provider>
            </div>
          ))}
        </main>
      ) : null}
      {macos && !file && !previewError && !settingsOpen && (
        <main className="mac-welcome">
          <img src="/app-icon.png" alt="" width="52" height="52" />
          <h1>选择文件，即刻预览</h1>
          <p>将文件拖到这里，或在 Finder 中选中后按 {previewKey}。</p>
          <button className="mac-primary" onClick={() => void choose()}>
            打开文件… <kbd>⌘O</kbd>
          </button>
          {desktop && agent && (
            <div className="mac-preview-status" role="status">
              {!settings.spaceEnabled ? (
                <>
                  <p>Finder 快捷键预览已关闭</p>
                  <button onClick={() => setSettings((s) => ({ ...s, spaceEnabled: true }))}>
                    启用 Finder 预览
                  </button>
                </>
              ) : agent.running ? (
                <p>Finder 空格预览已就绪</p>
              ) : (
                <>
                  <p>
                    {!agent.accessibility
                      ? '需要辅助功能权限，才能接收 Finder 空格按键。'
                      : !agent.automation
                        ? '需要自动化权限，才能读取 Finder 所选文件。'
                        : '键盘监听未就绪，请检查输入监控权限。'}
                  </p>
                  <button
                    onClick={() =>
                      void invoke('request_agent_permissions').catch((error) =>
                        setToast(`权限请求失败：${String(error)}`),
                      )
                    }
                  >
                    设置 Finder 预览权限…
                  </button>
                  <small>
                    请为当前运行的瞬览授权；更新或更换应用位置后，可能需要在系统设置中重新添加。授权后自动重试。
                  </small>
                </>
              )}
            </div>
          )}
          <button
            className="mac-settings-link"
            onClick={() => {
              setSettingsPage('settings');
              setSettingsOpen(true);
            }}
          >
            设置…
          </button>
        </main>
      )}
      {(settingsOpen || (!macos && !file && !previewError)) && (
        <div className="settings-workspace">
          <section
            className={'settings-dialog' + (!file ? ' welcome' : '')}
            role={settingsOpen ? 'dialog' : 'region'}
            aria-modal={settingsOpen ? true : undefined}
            aria-labelledby="settings-title"
          >
            <aside className="settings-sidebar">
              {settingsOpen && (
                <button autoFocus className="settings-back" onClick={() => setSettingsOpen(false)}>
                  <ArrowLeft size={16} />
                  {file ? '返回预览' : '返回首页'}
                </button>
              )}
              <div className="settings-brand">
                <img src="/app-icon.png" alt="" width="56" height="56" />
                <strong>瞬览</strong>
                <span>SpacePreview</span>
              </div>
              <nav aria-label="设置分类">
                {settingsPages.map((page) => (
                  <button
                    key={page.id}
                    aria-current={settingsPage === page.id ? 'page' : undefined}
                    onClick={() => {
                      setSettingsPage(page.id);
                      setRecording(null);
                      setShortcutError('');
                    }}
                  >
                    <page.icon size={18} strokeWidth={1.6} />
                    <span>{page.label}</span>
                  </button>
                ))}
              </nav>
              <span className="settings-version">v{version}</span>
            </aside>
            <div className="settings-main">
              <div className="dialog-header">
                <h2 id="settings-title">
                  {settingsPages.find((page) => page.id === settingsPage)?.label}
                </h2>
              </div>
              <div className="settings-content" key={settingsPage}>
                <section
                  hidden={settingsPage !== 'guide'}
                  className="settings-page guide-page"
                  aria-label="使用指南"
                >
                  <p className="page-intro">在文件管理器中预览文件，无需打开关联应用。</p>
                  <div className="guide-step">
                    <span className="step-number">1</span>
                    <div>
                      <h3>选中文件</h3>
                      <p>在 {fileManager} 或桌面中，单击选中需要查看的文件或文件夹。</p>
                    </div>
                    <FolderOpen size={22} />
                  </div>
                  <div className="guide-step">
                    <span className="step-number">2</span>
                    <div>
                      <h3>按下预览快捷键</h3>
                      <p>查看文件内容；文件夹会显示左侧目录树，可逐层展开并预览文件。</p>
                    </div>
                    <kbd>{previewKey}</kbd>
                  </div>
                  <div className="guide-step">
                    <span className="step-number">3</span>
                    <div>
                      <h3>关闭预览</h3>
                      <p>再次按 {previewKey} 或 Esc，返回文件管理器。</p>
                    </div>
                    <kbd>Esc</kbd>
                  </div>
                  <div className="guide-tip">
                    <Keyboard size={18} />
                    <p>
                      按 Shift + {previewKey} 可使用纯文本模式。你可以在「设置」中更改预览按键。
                    </p>
                  </div>
                  <div className="settings-note">
                    <Info size={16} />
                    <p>
                      {desktop
                        ? agent?.supported
                          ? `${settings.spaceEnabled && agent.running ? `在 ${fileManager} 或桌面选中文件，按 ${previewKey} 即可预览。` : settings.spaceEnabled ? '系统快捷键尚未就绪，可先选择或拖入文件预览。' : '文件管理器快捷键预览已关闭，可选择或拖入文件预览。'}${macos ? '首次使用需要系统授权。关闭窗口后仍在菜单栏运行。' : '关闭窗口后仍在托盘运行。'}`
                          : '当前系统支持文件选择与拖入，暂未接入文件管理器空格预览。'
                        : '浏览器中仅展示使用说明与设置界面。文件管理器快捷键预览需要桌面版。'}
                    </p>
                  </div>
                </section>
                <section
                  hidden={settingsPage !== 'settings'}
                  className="settings-page"
                  aria-label="应用设置"
                >
                  <h3>应用主题</h3>
                  <div className="theme-options">
                    {(['system', 'light', 'dark'] as const).map((theme, i) => (
                      <button
                        key={theme}
                        className={settings.theme === theme ? 'selected' : ''}
                        onClick={() => setSettings((s) => ({ ...s, theme }))}
                      >
                        {[<Monitor size={18} />, <Sun size={18} />, <Moon size={18} />][i]}
                        {['跟随系统', '浅色', '深色'][i]}
                      </button>
                    ))}
                  </div>
                  <h3>窗口与启动</h3>
                  <div className="settings-toggles">
                    <div className="setting-row">
                      <Eye className="setting-icon" size={22} strokeWidth={1.5} />
                      <div>
                        <strong>失去焦点时关闭</strong>
                        <p>{desktop ? '切换到其他应用时隐藏预览窗口' : '仅在桌面版中生效'}</p>
                      </div>
                      <button
                        role="switch"
                        aria-checked={settings.closeOnBlur}
                        aria-label="失去焦点时关闭"
                        disabled={!desktop}
                        className={`switch ${settings.closeOnBlur ? 'on' : ''}`}
                        onClick={() => setSettings((s) => ({ ...s, closeOnBlur: !s.closeOnBlur }))}
                      >
                        <span />
                      </button>
                    </div>
                    <div className="setting-row">
                      <Monitor className="setting-icon" size={22} strokeWidth={1.5} />
                      <div>
                        <strong>开机自启动</strong>
                        <p>
                          {!desktop
                            ? '仅在桌面版中生效'
                            : autostartBusy
                              ? '正在同步系统启动设置…'
                              : autostart === null
                                ? '无法读取状态，请重新打开设置'
                                : `登录后在${macos ? '菜单栏' : '托盘'}运行，不弹出预览窗口`}
                        </p>
                      </div>
                      <button
                        role="switch"
                        aria-label="开机自启动"
                        aria-checked={autostart === true}
                        disabled={!desktop || autostart === null || autostartBusy}
                        className={`switch ${autostart ? 'on' : ''}`}
                        onClick={() => void toggleAutostart()}
                      >
                        <span />
                      </button>
                    </div>
                  </div>
                  {desktop && agent?.supported && (
                    <div className="setting-row">
                      <Keyboard className="setting-icon" size={22} strokeWidth={1.5} />
                      <div>
                        <strong>{fileManager} 快捷键预览</strong>
                        <p>
                          {!settings.spaceEnabled
                            ? '快捷键预览已关闭，可选择文件或拖入预览'
                            : agent.running
                              ? `快捷键已启用 · 支持 ${fileManager} 与桌面`
                              : macos
                                ? !agent.accessibility
                                  ? '请授权辅助功能，才能接收 Finder 的预览快捷键'
                                  : !agent.automation
                                    ? '请允许瞬览读取 Finder 中选中的文件'
                                    : '键盘监听未就绪，请检查权限后重启瞬览'
                                : '原生监听未启动，请重新启动瞬览'}
                        </p>
                      </div>
                      <button
                        role="switch"
                        aria-checked={settings.spaceEnabled}
                        aria-label={`${fileManager} 快捷键预览`}
                        className={`switch ${settings.spaceEnabled ? 'on' : ''}`}
                        onClick={() =>
                          setSettings((s) => ({ ...s, spaceEnabled: !s.spaceEnabled }))
                        }
                      >
                        <span />
                      </button>
                    </div>
                  )}
                  {desktop &&
                    macos &&
                    settings.spaceEnabled &&
                    agent?.supported &&
                    !agent.running && (
                      <div className="mac-permissions">
                        <p>
                          系统设置 → 隐私与安全性：在「辅助功能」中启用瞬览，
                          并在「自动化」中允许控制 Finder。
                          若键盘监听仍未就绪，检查「输入监控」或重启应用。
                          未授权时仍可选择文件或拖入预览，Finder 原有空格预览保持可用。
                        </p>
                        <button
                          onClick={() => {
                            void invoke('request_agent_permissions')
                              .then(() =>
                                setToast('请在 macOS 系统权限提示中完成授权，状态会自动更新。'),
                              )
                              .catch((error) => setToast(`权限请求失败：${String(error)}`));
                          }}
                        >
                          授权 Finder 预览
                        </button>
                      </div>
                    )}
                  {desktop && macos && agent?.qspaceInstalled && (
                    <div className="mac-permissions">
                      <strong>QSpace Pro</strong>
                      <p>
                        {agent.qspaceRunning
                          ? '当前面板的快捷键预览已就绪'
                          : '需单独允许瞬览读取 QSpace Pro 的选中文件。仅支持可读取的本地文件；未授权时保留 QSpace 的原有预览。'}
                      </p>
                      {!agent.qspaceRunning && (
                        <button
                          onClick={() =>
                            void invoke('request_agent_permissions', { manager: 'qspace' }).catch(
                              (error) => setToast(`权限请求失败：${String(error)}`),
                            )
                          }
                        >
                          授权 QSpace Pro 预览
                        </button>
                      )}
                    </div>
                  )}
                  {desktop && macos && agent?.selectionError && (
                    <p className="shortcut-help" role="alert">
                      {agent.selectionError}
                    </p>
                  )}
                  {desktop && macos && agent && (
                    <p className="shortcut-help" role="status">
                      最近一次文件管理器预览按键：
                      {
                        [
                          '尚未收到',
                          '前台不是受支持的文件管理器',
                          '当前文件管理器自动化权限未就绪',
                          '文件区焦点读取失败或超时',
                          '焦点在输入框、工具栏或侧边栏',
                          '未识别到文件区',
                          '已接管',
                        ][agent.lastKeyResult ?? 0]
                      }
                    </p>
                  )}
                </section>
                <section
                  hidden={settingsPage !== 'preview'}
                  className="settings-page"
                  aria-label="预览设置"
                >
                  <PreviewPreferencesSettings />
                </section>
                <section
                  hidden={settingsPage !== 'shortcuts'}
                  className="settings-page"
                  aria-label="快捷键设置"
                >
                  <h3>预览快捷键</h3>
                  <div className="shortcut-editors">
                    {(['windowsShortcut', 'macosShortcut'] as const)
                      .filter((platform) => !macos || platform === 'macosShortcut')
                      .map((platform) => (
                        <div className="shortcut-editor" key={platform}>
                          <span>{platform === 'windowsShortcut' ? 'Windows' : 'macOS'}</span>
                          <button
                            className={`shortcut-record ${recording === platform ? 'recording' : ''}`}
                            aria-label={`修改 ${platform === 'windowsShortcut' ? 'Windows' : 'macOS'} 预览快捷键`}
                            onClick={() => {
                              spaceAction.current = null;
                              setRecording(platform);
                              setShortcutError('');
                            }}
                            onBlur={() =>
                              setRecording((current) => (current === platform ? null : current))
                            }
                          >
                            <Keyboard size={15} />
                            {recording === platform
                              ? '请按快捷键…'
                              : shortcutLabel(settings[platform], platform === 'macosShortcut')}
                          </button>
                          <button
                            className="shortcut-reset"
                            aria-label={`恢复 ${platform === 'windowsShortcut' ? 'Windows' : 'macOS'} 默认快捷键`}
                            onClick={() => {
                              setRecording(null);
                              setShortcutError('');
                              setSettings((s) => ({ ...s, [platform]: defaultShortcut }));
                            }}
                          >
                            重置
                          </button>
                        </div>
                      ))}
                  </div>
                  <p
                    className={`shortcut-help ${shortcutError ? 'shortcut-error' : ''}`}
                    role={shortcutError ? 'alert' : undefined}
                  >
                    {shortcutError ||
                      '点击按键后录入，自动保存；Esc 取消。Shift + 预览快捷键用于纯文本模式。请避开系统已占用的组合。'}
                  </p>
                  <h3>预览内操作</h3>
                  <div className="shortcut-editors">
                    {previewActions.map((action) => (
                      <div className="shortcut-editor" key={action}>
                        <span>{actionLabels[action]}</span>
                        <button
                          className={`shortcut-record ${recording === action ? 'recording' : ''}`}
                          aria-label={`修改${actionLabels[action]}快捷键`}
                          onClick={() => {
                            spaceAction.current = null;
                            setRecording(action);
                            setShortcutError('');
                          }}
                          onBlur={() =>
                            setRecording((current) => (current === action ? null : current))
                          }
                        >
                          <Keyboard size={15} />
                          {recording === action
                            ? '请按快捷键…'
                            : actionLabel(actions[action], macos)}
                        </button>
                        <button
                          className="shortcut-reset"
                          aria-label={`重置${actionLabels[action]}快捷键`}
                          onClick={() => {
                            const next = defaultActions(macos)[action];
                            setRecording(null);
                            if (actionConflict(next, action, actions, shortcut)) {
                              setShortcutError('默认快捷键已被其他操作占用，请先修改该操作。');
                              return;
                            }
                            setShortcutError('');
                            setSettings((s) => ({
                              ...s,
                              [actionSettingsKey]: { ...s[actionSettingsKey], [action]: next },
                            }));
                          }}
                        >
                          重置
                        </button>
                      </div>
                    ))}
                  </div>
                  <p className="shortcut-help">
                    跟随 Finder /
                    资源管理器当前视图切换并同步选中项，保留当前排序和搜索结果。请从文件管理器唤起预览；原窗口或标签页改变后需重新选中文件。文档可用滚轮或
                    Page Up / Down 浏览，输入框和目录树保留方向键操作。
                  </p>
                  <h3>常用操作</h3>
                  <div className="shortcuts">
                    {[
                      ['选择文件', macos ? '⌘O' : 'Ctrl + O'],
                      ['文件内检索', macos ? '⌘F' : 'Ctrl + F'],
                      ['关闭预览', `${previewKey} / Esc`],
                      ['纯文本预览', `Shift + ${previewKey}`],
                      ['增大 / 减小文字', macos ? '⌘ + / −' : 'Ctrl + + / −'],
                      ['滚轮调整文字', macos ? '⌘ + 滚轮上 / 下' : 'Ctrl + 滚轮上 / 下'],
                    ].map(([label, key]) => (
                      <div key={label}>
                        <span>{label}</span>
                        <kbd>{key}</kbd>
                      </div>
                    ))}
                  </div>
                  <p className="shortcut-help">
                    文字每次调整 2px；字体和字号可在「预览」设置中统一调整。Word/RTF 页面、PDF
                    保留原字体，快捷键缩放页面。输入框保留自身按键；播放视频后仍可用预览快捷键关闭；Esc
                    先关闭菜单或设置。
                  </p>
                </section>
                <section
                  hidden={settingsPage !== 'about'}
                  className="settings-page"
                  aria-label="关于与更新"
                >
                  <div className="about-app">
                    <img src="/app-icon.png" alt="瞬览图标" width="64" height="64" />
                    <div>
                      <h3>瞬览 SpacePreview</h3>
                      <p>版本 {version} · 本地文件预览</p>
                    </div>
                  </div>
                  <UpdateSettings updater={updater} />
                </section>
              </div>
            </div>
          </section>
        </div>
      )}
      {updater.notice && !settingsOpen && (file || settingsPage !== 'about') && (
        <div className="update-notice" role="status">
          <span>瞬览 v{updater.state.version} 已可更新</span>
          <button
            className="update-button"
            onClick={() => {
              setSettingsOpen(true);
              setSettingsPage('about');
              updater.dismiss();
              requestAnimationFrame(() => {
                document.querySelector('.update-settings')?.scrollIntoView({ block: 'center' });
              });
            }}
          >
            查看更新
          </button>
          <button className="icon-button" aria-label="稍后更新" onClick={updater.dismiss}>
            <X size={15} />
          </button>
        </div>
      )}
      {dragging && (
        <div className="drop-overlay">
          <Upload size={42} />
          <h2>释放文件以预览</h2>
          <p>支持一次拖入多个文件</p>
        </div>
      )}
      {opening && <div className="opening-indicator">正在读取文件…</div>}
      {toast && (
        <div className="toast" role="status">
          <Info size={16} />
          <span>{toast}</span>
          <button title="关闭提示" onClick={() => setToast('')}>
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
