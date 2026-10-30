import { useLayoutEffect, useRef, type ReactNode } from 'react';
export type ScrollPositions = Map<string, Array<{ top: number; left: number }>>;
// Keep positions, never parsed documents or detached DOM trees, for inactive tabs.
export default function TabReadingPosition({
  identity,
  positions,
  children,
  remember = true,
}: {
  identity: string;
  positions: ScrollPositions;
  children: ReactNode;
  remember?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const shouldRemember = useRef(remember);
  shouldRemember.current = remember;
  useLayoutEffect(() => {
    const element = root.current!;
    const saved = positions.get(identity);
    let restoring = !!saved?.length;
    let frame = 0;
    const scrollers = () => {
      const result = Array.from(
        element.querySelectorAll<HTMLElement>(
          '.document-scroll, .code-scroll, .pdf-scroll, .office-scroll, .workbook-scroll, .slide-scroll, .reading-outline, .directory-tree, .archive-list',
        ),
      );
      element.querySelectorAll('iframe').forEach((iframe) => {
        try {
          if (iframe.contentDocument?.scrollingElement)
            result.push(iframe.contentDocument.scrollingElement as HTMLElement);
        } catch {
          /* Sandboxed content owns its scroll. */
        }
      });
      return result;
    };
    const restore = () => {
      frame = 0;
      if (!restoring) return;
      const nodes = scrollers();
      if (!nodes.length) return;
      let complete = true;
      nodes.forEach((node, i) => {
        if (!saved?.[i]) return;
        node.scrollTop = saved[i].top;
        node.scrollLeft = saved[i].left;
        if (Math.abs(node.scrollTop - saved[i].top) > 1) complete = false;
      });
      if (complete) {
        restoring = false;
        observer.disconnect();
      }
    };
    const schedule = () => {
      if (restoring && !frame) frame = requestAnimationFrame(restore);
    };
    const observer = new MutationObserver(schedule);
    const loaded = (event: Event) => {
      if (restoring && event.target instanceof HTMLIFrameElement) {
        try {
          if (event.target.contentDocument)
            observer.observe(event.target.contentDocument, { childList: true, subtree: true });
        } catch {
          /* Cross-origin frames remain isolated. */
        }
      }
      schedule();
    };
    observer.observe(element, { childList: true, subtree: true });
    const stop = () => {
      restoring = false;
      observer.disconnect();
    };
    const timer = window.setTimeout(stop, 10000);
    element.addEventListener('load', loaded, true);
    element.addEventListener('wheel', stop, { passive: true });
    element.addEventListener('pointerdown', stop);
    element.addEventListener('keydown', stop);
    schedule();
    return () => {
      const nodes = scrollers();
      if (!shouldRemember.current) positions.delete(identity);
      else if (!restoring || !saved)
        positions.set(
          identity,
          nodes.map((node) => ({ top: node.scrollTop, left: node.scrollLeft })),
        );
      observer.disconnect();
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      element.removeEventListener('load', loaded, true);
      element.removeEventListener('wheel', stop);
      element.removeEventListener('pointerdown', stop);
      element.removeEventListener('keydown', stop);
    };
  }, [identity, positions]);
  return (
    <div ref={root} className="tab-preview-content">
      {children}
    </div>
  );
}
