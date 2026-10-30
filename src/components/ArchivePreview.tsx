import { usePreviewPreferences } from './PreviewPreferences';
import PreviewToolbar from './PreviewToolbar';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, ArrowLeft, Search, FolderOpen } from 'lucide-react';
import Preview from './Preview';
import { archiveTree, type ArchiveNode } from '../lib/archive-tree';
import { extension, formatSize, previewMime, type PreviewFile } from '../lib/files';
import { readRange } from '../lib/bridge';
import { readZipDirectory, readZipEntry, ZIP_ENTRY_LIMIT } from '../lib/zip-range';
import { parseInWorker } from '../lib/worker-client';
import type { ArchiveEntry } from '../lib/worker-types';
import FileIcon from './FileIcon';
import { useFileSearch } from './FileSearch';
import { findText } from '../lib/find';
import { openArchive } from '../lib/archive-session';
import PreviewSession, {
  newSessionCache,
  usePreviewState,
  type SessionCache,
} from './PreviewSession';

function entryReason(entry: ArchiveEntry, maxMiB: number) {
  if (!entry.directory && entry.size > maxMiB * 1024 * 1024) return `超过预览上限 ${maxMiB} MB`;
  return entry.directory
    ? ''
    : entry.encrypted
      ? '已加密'
      : entry.sourcePath !== undefined
        ? entry.size > 256 * 1024 * 1024
          ? '超过 256 MB'
          : ''
        : ![0, 8].includes(entry.method ?? -1)
          ? '算法不支持'
          : entry.size > ZIP_ENTRY_LIMIT || entry.compressed > ZIP_ENTRY_LIMIT
            ? '超过 32 MB'
            : '';
}

export default function ArchivePreview({ file }: { file: PreviewFile }) {
  const { preferences } = usePreviewPreferences();
  const [entries, setEntries] = useState<ArchiveEntry[] | null>(null);
  const [error, setError] = useState('');
  const [entryError, setEntryError] = useState('');
  const [expanded, setExpanded] = usePreviewState('archive.expanded', () => new Set<string>());
  const [visible, setVisible] = usePreviewState<Record<string, number>>('archive.visible', {});
  const [stack, setStack] = useState<PreviewFile[]>([]);
  const [query, setQuery] = usePreviewState('archive.query', '');
  useFileSearch(
    useMemo(
      () =>
        !stack.length && entries
          ? {
              scope: '压缩包文件名',
              search: (keyword: string) =>
                entries
                  .filter((entry) => !entry.directory && findText(entry.name, keyword).length)
                  .map((entry) => ({
                    label: entry.name,
                    goTo: () => {
                      setQuery(entry.name);
                      setVisible({});
                    },
                  })),
            }
          : null,
      [entries, stack.length],
    ),
  );
  const [extracting, setExtracting] = useState(false);
  const [selected, setSelected] = usePreviewState('archive.selected', '');
  const restoreSelected = useRef(selected);
  const [childViews] = usePreviewState('archive.views', () => new Map<string, SessionCache>());
  const childView = (name: string) => {
    let cache = childViews.get(name);
    if (!cache) {
      cache = newSessionCache();
      childViews.set(name, cache);
    }
    return cache;
  };
  const [reload, setReload] = useState(0);
  const [password, setPassword] = useState('');
  const session = useRef<Awaited<ReturnType<typeof openArchive>> | null>(null);
  const zip = [
    'zip',
    'jar',
    'apk',
    'ipa',
    'cbz',
    'whl',
    'nupkg',
    'snupkg',
    'vsix',
    'xpi',
    'egg',
    'pyz',
    'appx',
    'appxbundle',
    'msix',
    'msixbundle',
    'aab',
    'hap',
    'wgt',
    'wgtu',
    'qlplugin',
  ].includes(extension(file.name));
  const extraction = useRef<AbortController | null>(null);
  const read = (offset: number, length: number) => readRange(file, offset, length);
  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setError('');
      setEntries(null);
      setStack([]);
      if (reload) {
        setSelected('');
        setExpanded(new Set());
        setVisible({});
      }
      setEntryError('');
      setExtracting(false);
      if (!zip) {
        const archive = await openArchive(file, controller.signal, password);
        if (controller.signal.aborted) {
          archive.close();
          return;
        }
        session.current = archive;
        setEntries(archive.entries);
        return;
      }
      const directory = await readZipDirectory(file.size, (offset, length) =>
        readRange(file, offset, length),
      );
      if (controller.signal.aborted) return;
      const parsed = await parseInWorker(
        { kind: 'archive-directory', name: file.name, ...directory },
        controller.signal,
      );
      if (!controller.signal.aborted) setEntries(parsed.entries!);
    };
    void load().catch((e) => {
      if (!controller.signal.aborted) setError(e.message);
    });
    return () => {
      controller.abort();
      session.current?.close();
      session.current = null;
      extraction.current?.abort();
    };
  }, [file, reload, zip]);
  const nodes = useMemo(() => archiveTree(entries ?? []), [entries]);
  const matches = useMemo(
    () =>
      query
        ? (entries ?? [])
            .filter(
              (entry) => !entry.directory && entry.name.toLowerCase().includes(query.toLowerCase()),
            )
            .map((entry) => ({ id: `file:${entry.index}:${entry.name}`, name: entry.name, entry }))
        : nodes,
    [entries, nodes, query],
  );
  const toggle = (id: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const openEntry = async (entry: ArchiveEntry) => {
    if (entry.directory || entryReason(entry, preferences.maxPreviewMiB)) return;
    setSelected(`file:${entry.index}:${entry.name}`);
    setStack([]);
    extraction.current?.abort();
    const controller = new AbortController();
    extraction.current = controller;
    setExtracting(true);
    setEntryError('');
    try {
      let blob: Blob;
      if (session.current) {
        blob = await session.current.extract(entry);
      } else {
        const bytes = await readZipEntry(entry, file.size, read);
        if (controller.signal.aborted) return;
        const result = await parseInWorker(
          { kind: 'archive-data', name: file.name, bytes, entry },
          controller.signal,
        );
        if (controller.signal.aborted) return;
        blob = new Blob([result.data as Uint8Array<ArrayBuffer>]);
      }
      if (controller.signal.aborted) return;
      const name = entry.name.split('/').pop() || entry.name;
      const mime = previewMime(name);
      blob = blob.slice(0, blob.size, mime);
      setStack([
        {
          id: crypto.randomUUID(),
          name,
          size: blob.size,
          modified: file.modified,
          mime,
          blob,
        },
      ]);
    } catch (e) {
      if (!controller.signal.aborted) setEntryError(e instanceof Error ? e.message : String(e));
    } finally {
      if (!controller.signal.aborted) setExtracting(false);
    }
  };
  useEffect(() => {
    if (!entries || !restoreSelected.current) return;
    const id = restoreSelected.current;
    restoreSelected.current = '';
    const entry = entries.find((item) => `file:${item.index}:${item.name}` === id);
    if (entry) void openEntry(entry);
  }, [entries]);
  const passwordControls = !zip && (
    <PreviewToolbar className="content-toolbar">
      <label className="preview-menu-option">
        <span>压缩包密码</span>
        <input
          type="password"
          aria-label="压缩包密码"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      <button onClick={() => setReload((value) => value + 1)}>使用密码重新读取</button>
    </PreviewToolbar>
  );
  if (error)
    return (
      <>
        {passwordControls}
        <div className="preview-message" role="alert">
          {error}
          <p>可在窗口菜单中使用默认应用打开。</p>
        </div>
      </>
    );
  if (!entries)
    return (
      <div className="preview-message" role="status">
        <span className="spinner" />
        正在读取压缩包目录…
      </div>
    );
  const tree = (children: ArchiveNode[], parent = '', depth = 0): React.ReactNode => {
    const limit = visible[parent] ?? 100;
    return (
      <>
        {children.slice(0, limit).map((node) => {
          const reason = node.entry ? entryReason(node.entry, preferences.maxPreviewMiB) : '';
          return (
            <div
              key={node.id}
              role="treeitem"
              aria-expanded={node.children ? expanded.has(node.id) : undefined}
              aria-selected={selected === node.id}
            >
              <button
                className={`directory-row ${selected === node.id ? 'selected' : ''}`}
                style={{ paddingLeft: 10 + depth * 16 }}
                title={reason ? `${node.name} · ${reason}` : (node.entry?.name ?? node.id)}
                disabled={Boolean(reason) || (!zip && extracting)}
                onClick={() => (node.children ? toggle(node.id) : void openEntry(node.entry!))}
              >
                {node.children ? (
                  expanded.has(node.id) ? (
                    <ChevronDown size={14} />
                  ) : (
                    <ChevronRight size={14} />
                  )
                ) : (
                  <span className="tree-indent" />
                )}
                <FileIcon name={node.name} folder={!!node.children} size={16} />
                <span>{node.name}</span>
              </button>
              {node.children && expanded.has(node.id) && (
                <div role="group">{tree(node.children, node.id, depth + 1)}</div>
              )}
            </div>
          );
        })}
        {children.length > limit && (
          <button
            className="directory-more"
            onClick={() => setVisible((current) => ({ ...current, [parent]: limit + 100 }))}
          >
            显示更多（剩余 {children.length - limit} 项）
          </button>
        )}
        {!children.length && (
          <p className="directory-note">{query ? '没有匹配的文件' : '空文件夹'}</p>
        )}
      </>
    );
  };
  const current = stack.at(-1);
  return (
    <div className="directory-preview archive-tree-preview">
      {passwordControls}
      <aside className="directory-sidebar">
        <label className="search archive-tree-search">
          <Search size={14} />
          <input
            aria-label="筛选压缩包内容"
            placeholder="搜索压缩包"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setVisible({});
            }}
          />
        </label>
        <div
          className="directory-tree"
          role="tree"
          aria-label="压缩包目录"
          onKeyDown={(event) => {
            if (
              !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(
                event.key,
              )
            )
              return;
            const buttons = Array.from(
              event.currentTarget.querySelectorAll<HTMLButtonElement>(
                '.directory-row:not(:disabled)',
              ),
            );
            const index = buttons.indexOf(event.target as HTMLButtonElement);
            if (index < 0) return;
            event.preventDefault();
            event.stopPropagation();
            const node = buttons[index].parentElement!;
            if (event.key === 'ArrowRight') {
              if (node.getAttribute('aria-expanded') === 'false') buttons[index].click();
              else if (node.getAttribute('aria-expanded') === 'true') buttons[index + 1]?.focus();
            } else if (event.key === 'ArrowLeft') {
              if (node.getAttribute('aria-expanded') === 'true') buttons[index].click();
              else node.parentElement?.closest('[role=treeitem]')?.querySelector('button')?.focus();
            } else
              buttons[
                event.key === 'Home'
                  ? 0
                  : event.key === 'End'
                    ? buttons.length - 1
                    : Math.max(
                        0,
                        Math.min(buttons.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)),
                      )
              ]?.focus();
          }}
        >
          {tree(matches, query ? 'search' : '')}
        </div>
        <div className="directory-note">
          {entries.length.toLocaleString()} 项 · {formatSize(file.size)}
        </div>
      </aside>
      <section className="directory-content">
        {extracting || entryError ? (
          <div className="preview-message" role={entryError ? 'alert' : 'status'}>
            {extracting && <span className="spinner" />}
            {entryError || '正在读取所选文件…'}
            {extracting && (
              <button
                onClick={() => {
                  extraction.current?.abort();
                  setExtracting(false);
                  if (!zip) setReload((value) => value + 1);
                }}
              >
                取消
              </button>
            )}
          </div>
        ) : current ? (
          <>
            <div className="directory-file-heading">
              {stack.length > 1 && (
                <button
                  aria-label="返回上层文件"
                  onClick={() => setStack((value) => value.slice(0, -1))}
                >
                  <ArrowLeft size={16} />
                </button>
              )}
              <span>{current.name}</span>
            </div>
            <div className="directory-file-preview">
              <PreviewSession key={current.id} cache={childView(current.name)}>
                <Preview
                  key={current.id}
                  file={current}
                  mode="auto"
                  onOpen={(entry) => setStack((value) => [...value, entry])}
                />
              </PreviewSession>
            </div>
          </>
        ) : (
          <div className="preview-message">
            <FolderOpen size={40} />
            <h3>{file.name}</h3>
            <p>在左侧展开文件夹，选择文件查看内容。</p>
          </div>
        )}
      </section>
    </div>
  );
}
