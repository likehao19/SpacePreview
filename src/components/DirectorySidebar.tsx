import { useRef, type ReactNode } from 'react';
import { usePreviewState } from './PreviewSession';

export default function DirectorySidebar({ children }: { children: ReactNode }) {
  const [width, setWidth] = usePreviewState('directory.sidebarWidth', 260);
  const sidebar = useRef<HTMLElement>(null);
  const drag = useRef<{ x: number; width: number } | null>(null);
  const maximum = () =>
    Math.max(150, Math.min(640, (sidebar.current?.parentElement?.clientWidth ?? 1000) * 0.55));
  const resize = (next: number) => setWidth(Math.round(Math.max(150, Math.min(maximum(), next))));
  return (
    <>
      <aside className="directory-sidebar" ref={sidebar} style={{ width }}>
        {children}
      </aside>
      <div
        className="directory-resizer"
        role="separator"
        aria-label="调整文件目录宽度"
        aria-orientation="vertical"
        aria-valuemin={150}
        aria-valuemax={maximum()}
        aria-valuenow={width}
        tabIndex={0}
        onPointerDown={(event) => {
          drag.current = {
            x: event.clientX,
            width: sidebar.current!.getBoundingClientRect().width,
          };
          event.currentTarget.setPointerCapture(event.pointerId);
          event.preventDefault();
        }}
        onPointerMove={(event) => {
          if (drag.current) resize(drag.current.width + event.clientX - drag.current.x);
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
          const current = sidebar.current!.getBoundingClientRect().width;
          resize(
            event.key === 'Home'
              ? 150
              : event.key === 'End'
                ? maximum()
                : current + (event.key === 'ArrowRight' ? 16 : -16),
          );
        }}
      />
    </>
  );
}
