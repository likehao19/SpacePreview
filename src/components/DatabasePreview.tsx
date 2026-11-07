import { usePreviewLoading } from './PreviewLoading';
import { useEffect, useRef, useState } from 'react';
import PreviewToolbar from './PreviewToolbar';
import { TextAppearanceControls } from './TextAppearance';
import type { PreviewFile } from '../lib/files';
import { isSqliteDatabase, type DatabaseTable, type DatabasePage } from '../lib/database';
import { readBytes, readFullBytes } from '../lib/bridge';

export default function DatabasePreview({ file }: { file: PreviewFile }) {
  const [tables, setTables] = useState<DatabaseTable[]>([]);
  const [table, setTable] = useState('');
  const [page, setPage] = useState(0);
  const [result, setResult] = useState<DatabasePage>();
  const [schema, setSchema] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  usePreviewLoading(loading && !error, '正在查询数据库');
  const worker = useRef<Worker | null>(null);
  const sequence = useRef(0);
  useEffect(() => {
    const controller = new AbortController();
    const instance = new Worker(new URL('../workers/database.worker.ts', import.meta.url), {
      type: 'module',
    });
    worker.current = instance;
    instance.onmessage = (event) => {
      if (controller.signal.aborted || event.data.id !== sequence.current) return;
      setLoading(false);
      if (event.data.error) {
        setError(event.data.error);
        return;
      }
      if (event.data.tables) {
        setTables(event.data.tables);
        setTable(event.data.tables[0]?.name ?? '');
      } else setResult(event.data.result);
    };
    instance.onerror = () => {
      setError('数据库解析失败，文件可能已损坏或需要解密。');
      setLoading(false);
    };
    void readBytes(file, 16)
      .then((header) => {
        controller.signal.throwIfAborted();
        if (!isSqliteDatabase(header))
          throw new Error(
            '文件头不是标准 SQLite 格式。.db 也可能是软件专用缓存或加密数据库，当前无法读取其表与记录。可在更多菜单中查看文件信息，或使用创建它的软件打开。',
          );
        return readFullBytes(file, controller.signal);
      })
      .then((bytes) => {
        if (!controller.signal.aborted)
          instance.postMessage({ id: ++sequence.current, bytes }, [bytes.buffer]);
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          setError(e.message);
          setLoading(false);
        }
      });
    return () => {
      controller.abort();
      instance.terminate();
      worker.current = null;
    };
  }, [file]);
  useEffect(() => {
    if (!table || !worker.current) return;
    setLoading(true);
    setError('');
    setResult(undefined);
    worker.current.postMessage({ id: ++sequence.current, table, page });
  }, [table, page]);
  if (error)
    return (
      <div className="preview-message" role="alert">
        <h3>无法预览数据库内容</h3>
        <p>{error}</p>
      </div>
    );
  return (
    <div className="database-preview">
      <TextAppearanceControls />
      <PreviewToolbar className="content-toolbar">
        <span>SQLite · 只读 · {result?.count.toLocaleString() ?? '…'} 条记录</span>
        <button onClick={() => setSchema((value) => !value)}>
          {schema ? '查看记录' : '查看表结构'}
        </button>
        <button disabled={loading || !page} onClick={() => setPage((value) => value - 1)}>
          上一页
        </button>
        <span>
          {page + 1} / {Math.max(1, Math.ceil((result?.count ?? 0) / 200))}
        </span>
        <button
          disabled={loading || !result || (page + 1) * 200 >= result.count}
          onClick={() => setPage((value) => value + 1)}
        >
          下一页
        </button>
      </PreviewToolbar>
      <aside className="database-tables" aria-label="数据库表">
        <h2>表与视图</h2>
        {tables.map((item) => (
          <button
            key={item.name}
            aria-pressed={item.name === table}
            className={item.name === table ? 'active' : ''}
            onClick={() => {
              setTable(item.name);
              setPage(0);
            }}
          >
            {item.name}
            <small>{item.type === 'view' ? '视图' : '表'}</small>
          </button>
        ))}
      </aside>
      <div className="database-content">
        {loading ? (
          <div className="preview-message" role="status">
            <span className="spinner" />
            正在读取数据库…
          </div>
        ) : !table ? (
          <div className="preview-message">数据库没有表。</div>
        ) : schema ? (
          <pre className="database-schema">{result?.schema}</pre>
        ) : (
          result && (
            <table className="database-grid">
              <thead>
                <tr>
                  {result.columns.map((column) => (
                    <th key={column}>{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row, i) => (
                  <tr key={i}>
                    {row.map((value, j) => (
                      <td key={j} title={value}>
                        {value}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}
      </div>
    </div>
  );
}
