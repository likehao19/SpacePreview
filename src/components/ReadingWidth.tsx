import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { usePreviewPreferences } from './PreviewPreferences';
import { clampReadingWidth, defaultReadingWidths } from '../lib/reading-width';

export default function ReadingWidth({
  kind,
  children,
}: {
  kind: 'reading' | 'text' | 'code';
  children: ReactNode;
}) {
  const { preferences, setPreferences } = usePreviewPreferences();
  const key = `${kind}Width` as const;
  const saved = preferences[key];
  const [draft, setDraft] = useState<number | null>(null);
  const frame = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; width: number; side: number } | null>(null);
  const anchor = useRef<{ range: Range; top: number } | null>(null);
  const pending = useRef(0);
  const width = draft ?? saved;
  const remember = () => {
    const root = frame.current;
    if (!root) return;
    const scroller = root.parentElement!;
    const box = scroller.getBoundingClientRect();
    const doc = root.ownerDocument as Document & {
      caretRangeFromPoint?: (x: number, y: number) => Range | null;
    };
    const range = doc.caretRangeFromPoint?.(
      Math.max(box.left + 80, root.getBoundingClientRect().left + 64),
      box.top + 32,
    );
    if (range && root.contains(range.startContainer))
      anchor.current = { range, top: range.getBoundingClientRect().top };
  };
  useLayoutEffect(() => {
    if (anchor.current && frame.current) {
      const { range, top } = anchor.current;
      frame.current.parentElement!.scrollTop += range.getBoundingClientRect().top - top;
      anchor.current = null;
    }
  }, [width]);
  useLayoutEffect(() => () => cancelAnimationFrame(pending.current), []);
  const save = (value: number) => setPreferences((current) => ({ ...current, [key]: value }));
  return (
    <div
      ref={frame}
      className={`reading-width reading-width-${kind}`}
      style={{ width: width ? `${width}px` : '100%' }}
    >
      {(['left', 'right'] as const).map((side) => (
        <div
          key={side}
          className={`reading-width-handle ${side}`}
          role="separator"
          tabIndex={0}
          aria-label={`调整${kind === 'code' ? '代码' : kind === 'text' ? '文本' : '正文'}宽度（${side === 'left' ? '左侧' : '右侧'}）`}
          aria-orientation="vertical"
          aria-valuemin={320}
          aria-valuemax={1600}
          aria-valuenow={width || undefined}
          title="拖动调整阅读宽度；双击恢复默认"
          onDoubleClick={() => {
            setDraft(null);
            save(defaultReadingWidths[kind]);
          }}
          onPointerDown={(event) => {
            remember();
            drag.current = {
              x: event.clientX,
              width: frame.current!.getBoundingClientRect().width,
              side: side === 'right' ? 1 : -1,
            };
            event.currentTarget.setPointerCapture(event.pointerId);
            event.preventDefault();
          }}
          onPointerMove={(event) => {
            if (!drag.current) return;
            const value = clampReadingWidth(
              drag.current.width + (event.clientX - drag.current.x) * 2 * drag.current.side,
            );
            cancelAnimationFrame(pending.current);
            pending.current = requestAnimationFrame(() => {
              remember();
              setDraft(value);
            });
          }}
          onPointerUp={(event) => {
            cancelAnimationFrame(pending.current);
            if (drag.current && Math.abs(event.clientX - drag.current.x) > 1) {
              remember();
              save(
                clampReadingWidth(
                  drag.current.width + (event.clientX - drag.current.x) * 2 * drag.current.side,
                ),
              );
            }
            setDraft(null);
            drag.current = null;
          }}
          onPointerCancel={() => {
            cancelAnimationFrame(pending.current);
            setDraft(null);
            drag.current = null;
          }}
          onKeyDown={(event) => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'Space'].includes(event.code)) return;
            event.preventDefault();
            event.stopPropagation();
            if (event.code === 'Space') return;
            remember();
            save(
              event.code === 'Home'
                ? kind === 'reading'
                  ? 860
                  : 0
                : clampReadingWidth(
                    (width || frame.current!.getBoundingClientRect().width) +
                      (event.code === 'ArrowRight' ? 32 : -32),
                  ),
            );
          }}
          onKeyUp={(event) => event.stopPropagation()}
        />
      ))}
      {children}
    </div>
  );
}
