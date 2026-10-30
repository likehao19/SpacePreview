import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, FolderOpen, ArrowLeft, ExternalLink } from 'lucide-react';
import type { PreviewFile } from '../lib/files';
import { listDirectory, openDefault, type DirectoryPage } from '../lib/bridge';
import FileIcon from './FileIcon';
import Preview from './Preview';

type Branch = DirectoryPage & { loading?: boolean; error?: string };
export default function DirectoryPreview({
  file,
  mode,
}: {
  file: PreviewFile;
  mode: 'auto' | 'text' | 'info';
}) {
  const [branches, setBranches] = useState<Record<string, Branch>>({});
  const [expanded, setExpanded] = useState(new Set([file.id]));
  const [stack, setStack] = useState<PreviewFile[]>([]);
  const [error, setError] = useState('');
  const pending = useRef(new Set<string>());
  const alive = useRef(true);
  const selected = stack.at(-1);
  const load = async (folder: PreviewFile, offset = 0) => {
    if (pending.current.has(folder.id)) return;
    pending.current.add(folder.id);
    setBranches((all) => ({
      ...all,
      [folder.id]: { entries: all[folder.id]?.entries ?? [], nextOffset: offset, loading: true },
    }));
    try {
      const page = await listDirectory(folder, offset);
      if (!alive.current) return;
      setBranches((all) => {
        const entries = [...(offset ? (all[folder.id]?.entries ?? []) : []), ...page.entries];
        const unique = [...new Map(entries.map((entry) => [entry.id, entry])).values()];
        unique.sort(
          (a, b) =>
            Number(!!b.directory) - Number(!!a.directory) ||
            a.name.localeCompare(b.name, undefined, { numeric: true }),
        );
        return { ...all, [folder.id]: { entries: unique, nextOffset: page.nextOffset } };
      });
    } catch (reason) {
      if (alive.current)
        setBranches((all) => ({
          ...all,
          [folder.id]: { ...all[folder.id], loading: false, error: String(reason) },
        }));
    } finally {
      pending.current.delete(folder.id);
    }
  };
  useEffect(() => {
    alive.current = true;
    void load(file);
    return () => {
      alive.current = false;
    };
  }, [file]);
  const toggle = (folder: PreviewFile) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(folder.id)) next.delete(folder.id);
      else next.add(folder.id);
      return next;
    });
    if (!branches[folder.id]) void load(folder);
  };
  const tree = (folder: PreviewFile, depth = 0): React.ReactNode => {
    const branch = branches[folder.id];
    return (
      <>
        {branch?.entries.map((entry) => (
          <div
            key={entry.id}
            role="treeitem"
            aria-expanded={entry.directory ? expanded.has(entry.id) : undefined}
            aria-selected={stack[0]?.id === entry.id}
          >
            <button
              className={`directory-row ${stack[0]?.id === entry.id ? 'selected' : ''}`}
              style={{ paddingLeft: 10 + depth * 16 }}
              title={entry.path}
              onClick={() => (entry.directory ? toggle(entry) : (setStack([entry]), setError('')))}
            >
              {entry.directory ? (
                expanded.has(entry.id) ? (
                  <ChevronDown size={14} />
                ) : (
                  <ChevronRight size={14} />
                )
              ) : (
                <span className="tree-indent" />
              )}
              <FileIcon name={entry.name} folder={entry.directory} size={16} />
              <span>{entry.name}</span>
            </button>
            {entry.directory && expanded.has(entry.id) && (
              <div role="group">{tree(entry, depth + 1)}</div>
            )}
          </div>
        ))}
        {branch?.loading && (
          <p className="directory-note" role="status">
            正在读取…
          </p>
        )}
        {branch?.error && (
          <div className="directory-note" role="alert">
            {branch.error}
            <button onClick={() => void load(folder, branch.nextOffset ?? 0)}>重试</button>
          </div>
        )}
        {branch && !branch.loading && !branch.error && !branch.entries.length && (
          <p className="directory-note">空文件夹</p>
        )}
        {branch?.nextOffset != null && !branch.loading && !branch.error && (
          <button className="directory-more" onClick={() => void load(folder, branch.nextOffset!)}>
            加载更多
          </button>
        )}
      </>
    );
  };
  return (
    <div className="directory-preview">
      <aside className="directory-sidebar">
        <div
          className="directory-tree"
          role="tree"
          aria-label="文件夹目录"
          onKeyDown={(event) => {
            if (
              !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(
                event.key,
              )
            )
              return;
            event.preventDefault();
            event.stopPropagation();
            const buttons = Array.from(
              event.currentTarget.querySelectorAll<HTMLButtonElement>('.directory-row'),
            );
            const index = buttons.indexOf(event.target as HTMLButtonElement);
            const button = buttons[index];
            if (!button) return;
            const node = button.parentElement!;
            if (event.key === 'ArrowRight') {
              if (node.getAttribute('aria-expanded') === 'false') button.click();
              else buttons[index + 1]?.focus();
            } else if (event.key === 'ArrowLeft') {
              if (node.getAttribute('aria-expanded') === 'true') button.click();
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
          {tree(file)}
        </div>
      </aside>
      <section className="directory-content">
        {selected ? (
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
              <span title={selected.path ?? selected.name}>{selected.name}</span>
              {selected.path && (
                <button
                  title="默认应用打开所选文件"
                  onClick={() =>
                    void openDefault(selected).catch((reason) => setError(String(reason)))
                  }
                >
                  <ExternalLink size={16} />
                </button>
              )}
            </div>
            {error && <p role="alert">{error}</p>}
            <div className="directory-file-preview">
              <Preview
                key={`${selected.id}:${mode}`}
                file={selected}
                mode={mode}
                onOpen={(entry) => setStack((value) => [...value, entry])}
              />
            </div>
          </>
        ) : (
          <div className="preview-message">
            <FolderOpen size={40} />
            <h3>{file.name}</h3>
            <p>在左侧展开文件夹，选择文件查看内容。</p>
            <p>目录按需读取，不扫描整个项目。</p>
          </div>
        )}
      </section>
    </div>
  );
}
