import { usePreviewLoading } from './PreviewLoading';
import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy, TextLayer } from 'pdfjs-dist';

export default function PdfPage({
  doc,
  number,
  zoom,
  initialSize,
}: {
  doc: PDFDocumentProxy;
  number: number;
  zoom: number;
  initialSize: { width: number; height: number };
}) {
  const container = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const textContainer = useRef<HTMLDivElement>(null);
  const [nearby, setNearby] = useState(false);
  const [size, setSize] = useState(initialSize);
  const [rendered, setRendered] = useState(false);
  const [error, setError] = useState('');
  usePreviewLoading(nearby && !rendered && !error, `正在渲染 PDF 第 ${number} 页`);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setNearby(entry.isIntersecting), {
      root: container.current!.closest('.pdf-scroll'),
      rootMargin: '800px 0px',
    });
    observer.observe(container.current!);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    setRendered(false);
    if (!nearby) return;
    let cancelled = false;
    let render: ReturnType<Awaited<ReturnType<PDFDocumentProxy['getPage']>>['render']> | undefined;
    let textLayer: TextLayer | undefined;
    const target = canvas.current!;
    const textTarget = textContainer.current!;
    setError('');
    void doc
      .getPage(number)
      .then(async (page) => {
        if (cancelled) return;
        const base = page.getViewport({ scale: 1.15 });
        setSize({ width: base.width, height: base.height });
        const view = page.getViewport({ scale: zoom * 1.15 });
        // Bound each bitmap even for huge scanned pages and high zoom levels.
        const ratio = Math.min(
          2,
          window.devicePixelRatio,
          Math.sqrt(16_000_000 / (view.width * view.height)),
        );
        const viewport = page.getViewport({ scale: zoom * 1.15 * ratio });
        target.width = Math.ceil(viewport.width);
        target.height = Math.ceil(viewport.height);
        render = page.render({ canvas: target, viewport });
        await render.promise;
        if (cancelled) return;
        setRendered(true);
        const [content, engine] = await Promise.all([
          page.getTextContent(),
          import('pdfjs-dist/legacy/build/pdf.mjs'),
        ]);
        if (cancelled) return;
        textTarget.style.setProperty('--total-scale-factor', String(view.scale * view.userUnit));
        textLayer = new engine.TextLayer({
          textContentSource: content,
          container: textTarget,
          viewport: view,
        });
        await textLayer.render();
      })
      .catch((error) => {
        if (!cancelled && error?.name !== 'RenderingCancelledException') setError('此页无法渲染。');
      });
    return () => {
      cancelled = true;
      render?.cancel();
      textLayer?.cancel();
      textTarget.replaceChildren();
      target.width = target.height = 0;
    };
  }, [doc, number, nearby, zoom]);
  return (
    <section
      ref={container}
      className="pdf-page"
      data-pdf-page={number}
      data-rendered={rendered}
      aria-label={`PDF 第 ${number} 页`}
      style={{ width: size.width * zoom, height: size.height * zoom }}
    >
      <canvas
        ref={canvas}
        style={{ width: '100%', height: '100%', visibility: rendered ? 'visible' : 'hidden' }}
      />
      <div ref={textContainer} className="pdf-text-layer" />
      {!rendered && (
        <div className="pdf-page-status" role={error ? 'alert' : 'status'}>
          {!error && <span className="spinner" />} {error || `正在加载第 ${number} 页…`}
        </div>
      )}
    </section>
  );
}
