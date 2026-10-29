import { useEffect, useRef, useState } from 'react';
import type { OfdBox, OfdDocument } from '../lib/ofd';

// Match the PDF reader's default scale: A4 width renders at the same CSS width as PDF pages.
export const OFD_PX_PER_MM = (72 / 25.4) * 1.15;

export default function OfdPage({
  doc,
  index,
  zoom,
}: {
  doc: OfdDocument;
  index: number;
  zoom: number;
}) {
  const container = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const [nearby, setNearby] = useState(false);
  const [box, setBox] = useState<OfdBox>(doc.pages[index].box);
  const [rendered, setRendered] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setNearby(entry.isIntersecting), {
      root: container.current!.closest('.pdf-scroll'),
      rootMargin: '800px 0px',
    });
    observer.observe(container.current!);
    return () => observer.disconnect();
  }, []);
  // The SVG scales with CSS, so zoom never rebuilds page markup; leaving the viewport drops it.
  useEffect(() => {
    if (!nearby) return;
    const controller = new AbortController();
    let release: (() => void) | undefined;
    const target = canvas.current!;
    setError('');
    void doc
      .renderPage(index, controller.signal)
      .then(({ svg, box, release: dispose }) => {
        if (controller.signal.aborted) {
          dispose();
          return;
        }
        release = dispose;
        target.innerHTML = svg;
        setBox(box);
        setRendered(true);
      })
      .catch((reason) => {
        if (!controller.signal.aborted) setError(`此页无法渲染：${reason?.message ?? reason}`);
      });
    return () => {
      target.replaceChildren();
      controller.abort();
      release?.();
      setRendered(false);
    };
  }, [doc, index, nearby]);
  return (
    <section
      ref={container}
      className="pdf-page ofd-page"
      data-pdf-page={index + 1}
      data-rendered={rendered}
      aria-label={`OFD 第 ${index + 1} 页`}
      style={{ width: box[2] * OFD_PX_PER_MM * zoom, height: box[3] * OFD_PX_PER_MM * zoom }}
    >
      <div ref={canvas} className="ofd-canvas" />
      {!rendered && (
        <div className="pdf-page-status" role={error ? 'alert' : 'status'}>
          {!error && <span className="spinner" />} {error || `正在加载第 ${index + 1} 页…`}
        </div>
      )}
    </section>
  );
}
