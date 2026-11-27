import { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { PreviewFile } from '../lib/files';
import { desktop } from '../lib/bridge';
import { usePreviewPreferences } from './PreviewPreferences';

type FileChange =
  { state: 'unchanged' | 'missing' | 'unavailable' } | { state: 'changed'; file: PreviewFile };

const checkInterval = 1500;

export default function FileChangeNotice({
  file,
  onReload,
}: {
  file: PreviewFile;
  onReload: (previous: PreviewFile, next: PreviewFile) => void;
}) {
  const { preferences } = usePreviewPreferences();
  const [status, setStatus] = useState<FileChange['state']>('unchanged');
  const [busy, setBusy] = useState(false);
  const apply = useRef(onReload);
  apply.current = onReload;
  const reload = useRef<() => void>(() => {});

  useEffect(() => {
    if (
      !desktop ||
      !file.path ||
      !file.revision ||
      file.directory ||
      preferences.fileChanges === 'off'
    )
      return;
    let stopped = false;
    let checking = false;
    let requested = false;
    let previousRevision: string | undefined;
    let timer: number;

    async function check() {
      if (stopped || checking) return;
      window.clearTimeout(timer);
      checking = true;
      const manual = requested;
      requested = false;
      const result = await invoke<FileChange>('check_preview_file', {
        path: file.path,
        revision: file.revision,
      }).catch(() => ({ state: 'unavailable' }) as const);
      if (stopped) return;
      checking = false;
      if (manual) setBusy(false);

      if (result.state === 'changed') {
        const stable = result.file.revision === previousRevision;
        if (manual || (preferences.fileChanges === 'auto' && stable)) {
          apply.current(file, result.file);
          return;
        }
        previousRevision = result.file.revision;
      } else {
        previousRevision = undefined;
      }
      setStatus(result.state);
      timer = window.setTimeout(check, requested ? 0 : checkInterval);
    }

    reload.current = () => {
      setBusy(true);
      requested = true;
      void check();
    };
    timer = window.setTimeout(check, checkInterval);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, [file, preferences.fileChanges]);

  if (status === 'unchanged' || preferences.fileChanges === 'off') return null;
  return (
    <div className="file-change-notice">
      <span role="status">
        {status === 'changed'
          ? busy || preferences.fileChanges === 'auto'
            ? '正在重新加载…'
            : '文件已更新'
          : status === 'missing'
            ? '原文件已移除或改名'
            : '暂时无法读取原文件'}
      </span>
      {status === 'changed' && preferences.fileChanges === 'prompt' && (
        <button disabled={busy} onClick={() => reload.current()}>
          重新加载
        </button>
      )}
    </div>
  );
}
