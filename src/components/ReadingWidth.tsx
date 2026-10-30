import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { usePreviewPreferences } from './PreviewPreferences';
import { PreviewMenu } from './PreviewToolbar';
import { usePreviewState } from './PreviewSession';

export default function ReadingWidth({
  children,
  kind = 'document',
  gutterWidth = 0,
}: {
  children: ReactNode;
  kind?: 'document' | 'code';
  gutterWidth?: number;
}) {
  const { preferences, setPreferences } = usePreviewPreferences();
  const root = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; width: number; side: number } | null>(null);
  const [codeWidth, setCodeWidth] = usePreviewState('reading.codeWidth', 2400);
  const width = kind === 'code' ? codeWidth : preferences.readingWidth;
  useLayoutEffect(() => {
    if (kind !== 'code') return;
    const element = root.current!;
    const updateInset = () => {
      const inset =
        width === 2400 ? 20 : Math.max(20, (element.clientWidth - gutterWidth - width) / 2);
      element.style.setProperty('--code-inset', `${inset}px`);
    };
    updateInset();
    const observer = new ResizeObserver(updateInset);
    observer.observe(element);
    return () => observer.disconnect();
  }, [kind, width, gutterWidth]);
  const update = (next: number) => {
    const value = Math.round(Math.max(360, Math.min(2400, next)));
    if (kind === 'code') setCodeWidth(value);
    else setPreferences((current) => ({ ...current, readingWidth: value }));
  };
  return (
    <div
      ref={root}
      className={`reading-width reading-width-${kind}${width === 2400 ? ' reading-width-fit' : ''}${kind === 'code' && gutterWidth > 0 ? ' has-gutter' : ''}`}
      style={
        {
          '--reading-width': width === 2400 ? '100%' : `${width}px`,
          '--reading-gutter-width': `${gutterWidth}px`,
          '--line-number-width': `${gutterWidth || 36}px`,
        } as CSSProperties
      }
    >
      {kind === 'document' && (
        <PreviewMenu>
          <label className="preview-menu-option">
            <span>阅读宽度</span>
            <select
              aria-label="阅读宽度"
              value={width}
              onChange={(e) => update(Number(e.target.value))}
            >
              {![640, 860, 1080, 1440, 2400].includes(width) && (
                <option value={width}>{width} px</option>
              )}
              <option value={640}>紧凑 · 640 px</option>
              <option value={860}>默认 · 860 px</option>
              <option value={1080}>宽松 · 1080 px</option>
              <option value={1440}>宽幅 · 1440 px</option>
              <option value={2400}>适应窗口</option>
            </select>
          </label>
          <button onClick={() => update(860)}>恢复默认阅读宽度</button>
        </PreviewMenu>
      )}
      {children}
      {[-1, 1].map((side) => (
        <div
          key={side}
          className={`reading-width-handle ${side < 0 ? 'left' : 'right'}`}
          role="separator"
          aria-label={side < 0 ? '调整正文左侧宽度' : '调整正文右侧宽度'}
          aria-orientation="vertical"
          aria-valuemin={360}
          aria-valuemax={2400}
          aria-valuenow={width}
          tabIndex={0}
          onPointerDown={(event) => {
            drag.current = {
              x: event.clientX,
              width: Math.min(width, Math.max(360, root.current!.clientWidth - gutterWidth - 32)),
              side,
            };
            event.currentTarget.setPointerCapture(event.pointerId);
            event.preventDefault();
          }}
          onPointerMove={(event) => {
            if (drag.current)
              update(drag.current.width + (event.clientX - drag.current.x) * drag.current.side * 2);
          }}
          onPointerUp={() => {
            drag.current = null;
          }}
          onPointerCancel={() => {
            drag.current = null;
          }}
          onKeyDown={(event) => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            event.stopPropagation();
            const currentWidth = Math.min(
              width,
              Math.max(360, root.current!.clientWidth - gutterWidth - 32),
            );
            update(
              event.key === 'Home'
                ? 360
                : event.key === 'End'
                  ? 2400
                  : currentWidth + (event.key === 'ArrowRight' ? 32 : -32) * side,
            );
          }}
        />
      ))}
    </div>
  );
}
