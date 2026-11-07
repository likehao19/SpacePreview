import { invoke } from '@tauri-apps/api/core';
import { desktop } from '../lib/bridge';
import { extension } from '../lib/files';
import PreviewToolbar from './PreviewToolbar';
import { useEffect, useRef, useState } from 'react';
import { Minus, Plus, Maximize2 } from 'lucide-react';
import type { PreviewFile } from '../lib/files';
import type { CadDrawing } from '../lib/cad';
import { readBytes } from '../lib/bridge';
import { parseInWorker } from '../lib/worker-client';

export default function CadPreview({ file }: { file: PreviewFile }) {
  const [drawing, setDrawing] = useState<CadDrawing>();
  const [error, setError] = useState('');
  const [hidden, setHidden] = useState(new Set<string>());
  const [view, setView] = useState({ x: 0, y: 0, width: 1, height: 1 });
  const fitted = useRef(view);
  const drag = useRef<{ x: number; y: number; view: typeof view } | null>(null);
  const dwg = extension(file.name) !== 'dxf';
  useEffect(() => {
    const controller = new AbortController();
    const job = crypto.randomUUID();
    setError('');
    setDrawing(undefined);
    setHidden(new Set());
    if (dwg && (!desktop || !file.path)) {
      setError('DWG 完整图纸预览请在桌面版中打开本地文件。');
      return;
    }
    if (file.size > (dwg ? 32 : 8) * 1024 * 1024) {
      setError(dwg ? 'DWG 预览上限为 32 MiB。' : 'DXF 预览上限为 8 MiB。');
      return;
    }
    void (
      dwg
        ? invoke<ArrayBuffer>('read_dwg', { path: file.path, job }).then(
            (bytes) => new Uint8Array(bytes),
          )
        : readBytes(file, 8 * 1024 * 1024)
    )
      .then((bytes) => parseInWorker({ kind: 'dxf', name: file.name, bytes }, controller.signal))
      .then((result) => {
        const drawing = result.drawing!;
        let minX = Infinity,
          minY = Infinity,
          maxX = -Infinity,
          maxY = -Infinity;
        const include = (x: number, y: number) => {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        };
        drawing.paths.forEach((p) => p.points.forEach(([x, y]) => include(x, y)));
        drawing.labels.forEach((p) => {
          include(p.x, p.y);
          include(p.x + p.height * p.text.length * 0.6, p.y + p.height);
        });
        const width = Math.max(maxX - minX, 1),
          height = Math.max(maxY - minY, 1),
          padding = Math.max(width, height) * 0.06;
        fitted.current = {
          x: minX - padding,
          y: -maxY - padding,
          width: width + padding * 2,
          height: height + padding * 2,
        };
        setView(fitted.current);
        setDrawing(drawing);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => {
      controller.abort();
      if (dwg) void invoke('cancel_dwg', { job }).catch(() => {});
    };
  }, [file, dwg]);
  const zoom = (factor: number) =>
    setView((v) => {
      const next = v.width * factor;
      if (next < fitted.current.width / 100 || next > fitted.current.width * 20) return v;
      return {
        x: v.x + (v.width * (1 - factor)) / 2,
        y: v.y + (v.height * (1 - factor)) / 2,
        width: next,
        height: v.height * factor,
      };
    });
  if (error)
    return (
      <div className="preview-message" role="alert">
        {error}
      </div>
    );
  if (!drawing) return <div className="preview-message">正在解析 CAD 图纸…</div>;
  return (
    <div className="cad-preview">
      <PreviewToolbar className="content-toolbar">
        <span>
          {dwg ? 'DWG' : 'DXF'} · 二维模型空间 · {drawing.paths.length} 条轮廓
        </span>
        <div className="toolbar-right">
          <button title="缩小图纸" onClick={() => zoom(1.25)}>
            <Minus size={15} />
          </button>
          <button title="放大图纸" onClick={() => zoom(0.8)}>
            <Plus size={15} />
          </button>
          <button title="适应图纸" onClick={() => setView(fitted.current)}>
            <Maximize2 size={15} />
          </button>
        </div>
      </PreviewToolbar>
      {drawing.skipped > 0 && (
        <p className="format-note">已跳过 {drawing.skipped} 个不支持的图元。</p>
      )}
      <div className="cad-body">
        <aside className="cad-layers" aria-label="CAD 图层">
          <strong>图层 · {drawing.layers.length}</strong>
          {drawing.layers.map((layer) => (
            <label key={layer}>
              <input
                type="checkbox"
                checked={!hidden.has(layer)}
                onChange={() =>
                  setHidden((old) => {
                    const next = new Set(old);
                    next.has(layer) ? next.delete(layer) : next.add(layer);
                    return next;
                  })
                }
              />
              <span title={layer}>{layer}</span>
            </label>
          ))}
        </aside>
        <svg
          className="cad-canvas"
          aria-label={dwg ? 'DWG 图纸预览' : 'DXF 图纸预览'}
          viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`}
          onWheel={(e) => zoom(e.deltaY < 0 ? 0.85 : 1.15)}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            drag.current = { x: e.clientX, y: e.clientY, view };
          }}
          onPointerMove={(e) => {
            if (drag.current) {
              const d = drag.current,
                r = e.currentTarget.getBoundingClientRect(),
                scale = Math.max(d.view.width / r.width, d.view.height / r.height);
              setView({
                ...d.view,
                x: d.view.x - (e.clientX - d.x) * scale,
                y: d.view.y - (e.clientY - d.y) * scale,
              });
            }
          }}
          onPointerUp={() => {
            drag.current = null;
          }}
          onPointerCancel={() => {
            drag.current = null;
          }}
        >
          {drawing.paths
            .filter((p) => !hidden.has(p.layer))
            .map((p, i) => (
              <polyline
                key={i}
                points={p.points.map(([x, y]) => `${x},${-y}`).join(' ')}
                fill="none"
                stroke={
                  p.color === undefined || p.color === 0 || p.color === 0xffffff
                    ? '#d6e1ef'
                    : `#${p.color.toString(16).padStart(6, '0')}`
                }
                strokeWidth="1.3"
                vectorEffect="non-scaling-stroke"
              />
            ))}
          {drawing.labels
            .filter((p) => !hidden.has(p.layer))
            .map((p, i) => (
              <text
                key={i}
                x={p.x}
                y={-p.y}
                fill="#e3eaf5"
                fontSize={p.height}
                transform={`rotate(${-p.rotation} ${p.x} ${-p.y})`}
              >
                {p.text.split('\n').map((line, j) => (
                  <tspan key={j} x={p.x} dy={j ? p.height * 1.3 : 0}>
                    {line}
                  </tspan>
                ))}
              </text>
            ))}
        </svg>
      </div>
    </div>
  );
}
