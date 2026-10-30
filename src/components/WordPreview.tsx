import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFileSearch, type SearchHit } from './FileSearch';
import { findText, findRanges, scrollToRange } from '../lib/find';
import type { PreviewFile } from '../lib/files';
import { readFullBytes } from '../lib/bridge';
import { readWordPackage } from '../lib/word-package';
import { wordDom } from '../lib/word-dom';
import { mountWordScroll } from '../lib/word-scroll';
import { trackReadingPosition } from '../lib/reading-position';
import { buildWordOutline } from '../lib/word-outline';
import { documentError } from '../lib/document-error';
import { usePreviewState } from './PreviewSession';
import { forwardPreviewKey } from '../lib/shortcuts';
import { forwardPreviewWheel } from '../lib/preview-gestures';
import { PreviewAdjustmentIndicator, usePreviewGestures } from './TextAppearance';
import { ReadingLayout, type OutlineItem } from './DocumentReader';

export default function WordPreview({
  file,
  onText,
  format = 'docx',
}: {
  file: PreviewFile;
  onText: () => void;
  format?: 'docx' | 'rtf';
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const macos = /Mac/i.test(navigator.platform);
  const horizontalPadding = macos ? 16 : 40;
  const [ready, setReady] = useState(false);
  const [retry, setRetry] = useState(0);
  const resourceController = useRef(new AbortController());
  useEffect(() => {
    const controller = new AbortController();
    resourceController.current = controller;
    return () => controller.abort();
  }, [file, retry]);

  const parsed = useRef<{
    file: PreviewFile;
    doc: Awaited<ReturnType<typeof import('docx-preview').parseAsync>>;
    source: Awaited<ReturnType<typeof readWordPackage>>;
  } | null>(null);
  const [outline, setOutline] = useState<OutlineItem[]>([]);
  const [status, setStatus] = useState('正在读取文档…');
  const [error, setError] = useState('');
  const [zoom, setZoom] = usePreviewState('word.zoom', 'fit');
  const adjusting = usePreviewGestures(
    useCallback(
      (direction: number) =>
        setZoom((current) => {
          const fitted = parseFloat(
            frame.current?.contentDocument?.querySelector<HTMLElement>('section.docx')?.style
              .zoom ?? '1',
          );
          const value = current === 'fit' ? fitted : Number(current);
          return String(Math.max(0.2, Math.min(3, Number((value + direction * 0.1).toFixed(2)))));
        }),
      [],
    ),
  );
  const [rendered, setRendered] = useState(false);
  useFileSearch(
    useMemo(
      () =>
        rendered && parsed.current?.file === file
          ? {
              scope: 'Word 正文',
              async search(query: string, signal: AbortSignal) {
                const children = parsed.current!.doc.documentPart.body.children;
                const textOf = (node: {
                  type: string;
                  text?: string;
                  children?: typeof children;
                }): string =>
                  node.type === 'text'
                    ? (node.text ?? '')
                    : (node.children ?? []).map(textOf).join('');
                const matches: SearchHit[] = [];
                for (let index = 0; index < children.length; index++) {
                  signal.throwIfAborted();
                  if (index % 500 === 499) await new Promise((resolve) => setTimeout(resolve, 0));
                  if (!findText(textOf(children[index]), query).length) continue;
                  matches.push({
                    label: `第 ${index + 1} 段`,
                    goTo: async (navigationSignal) => {
                      const target = frame.current?.contentDocument;
                      if (!target) return;
                      const selector = `.word-search-block-${index}`;
                      if (!target.querySelector(selector))
                        target
                          .querySelector(`[data-word-section="${Math.floor(index / 200)}"]`)
                          ?.scrollIntoView({ block: 'start' });
                      const deadline = performance.now() + 10000;
                      while (!target.querySelector(selector) && performance.now() < deadline) {
                        navigationSignal.throwIfAborted();
                        await new Promise((resolve) => setTimeout(resolve, 50));
                      }
                      navigationSignal.throwIfAborted();
                      const element = target.querySelector(selector);
                      if (!element) throw new Error('此段落尚未加载，请重试跳转。');
                      const range = findRanges(element, query)[0];
                      if (range) scrollToRange(range);
                      else element.scrollIntoView({ block: 'center' });
                    },
                  });
                }
                return matches;
              },
            }
          : null,
      [rendered, file],
    ),
  );
  const [activeId, setActiveId] = useState('');
  const [pageCount, setPageCount] = useState(0);
  const [page, setPage] = useState(1);
  useEffect(() => {
    const doc = frame.current?.contentDocument;
    if (!rendered || !doc?.scrollingElement) return;
    if (doc.querySelector('[data-word-section]')) {
      setPageCount(0);
      return;
    }
    const headings = outline.flatMap((item) => {
      const element = doc.querySelector(`.${item.id}`);
      return element ? [{ id: item.id, element }] : [];
    });
    const stopOutline = trackReadingPosition(
      doc.scrollingElement as HTMLElement,
      headings,
      setActiveId,
    );
    const pages = Array.from(doc.querySelectorAll('section.docx')).map((element, i) => ({
      id: String(i + 1),
      element,
    }));
    setPageCount(pages.length);
    const stopPages = trackReadingPosition(doc.scrollingElement as HTMLElement, pages, (id) =>
      setPage(Number(id) || 1),
    );
    return () => {
      stopOutline();
      stopPages();
    };
  }, [rendered, outline]);
  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    const load = async () => {
      const target = frame.current?.contentDocument;
      if (!target) return;
      target.body.replaceChildren();
      target.head.querySelectorAll('style').forEach((style) => style.remove());
      setRendered(false);
      setError('');
      setStatus('正在读取文档…');
      setOutline([]);
      setPageCount(0);
      setPage(1);
      const style = target.createElement('style');
      style.textContent =
        'html{scrollbar-width:thin;scrollbar-color:var(--scroll-thumb) transparent} @supports selector(::-webkit-scrollbar){html{scrollbar-width:auto;scrollbar-color:auto}} body{margin:0;font-family:Calibri,"Microsoft YaHei",sans-serif} .docx-wrapper{padding:24px 20px;background:transparent;min-height:100vh;box-sizing:border-box} .docx-wrapper>section.docx{box-shadow:0 2px 12px #00000018,0 0 0 1px #00000006;margin-bottom:24px} [class*="word-heading-"]{scroll-margin-top:28px} a{pointer-events:none} ::-webkit-scrollbar{width:3px;height:5px} ::-webkit-scrollbar-thumb{background:var(--scroll-thumb);border:0;background-clip:padding-box;border-radius:10px} ::-webkit-scrollbar-thumb:hover{background:var(--scroll-hover)} ::-webkit-scrollbar-track{background:transparent}';
      if (macos)
        style.textContent +=
          '.docx-wrapper{padding:8px}.docx-wrapper>section.docx{border-radius:12px;overflow:hidden;box-shadow:none;margin-bottom:8px}';
      target.body.append(style);
      target.addEventListener(
        'click',
        (e) => {
          if ((e.target as Element).closest('a')) e.preventDefault();
        },
        { signal: controller.signal },
      );
      // Forward closing/navigation keys from the sandboxed document to the app.
      for (const type of ['keydown', 'keyup'] as const)
        target.addEventListener(type, forwardPreviewKey, { signal: controller.signal });
      target.addEventListener('wheel', forwardPreviewWheel, {
        passive: false,
        signal: controller.signal,
      });
      const headings: OutlineItem[] = [];
      let nodes: Node[];
      if (format === 'rtf') {
        const [bytes, engine] = await Promise.all([
          readFullBytes(file, controller.signal, (value) =>
            setStatus(`正在读取完整文档… ${value}%`),
          ),
          import('rtf.js'),
        ]);
        if (controller.signal.aborted) return;
        engine.RTFJS.loggingEnabled(false);
        engine.WMFJS.loggingEnabled(false);
        engine.EMFJS.loggingEnabled(false);
        const doc = new engine.RTFJS.Document(bytes.buffer as ArrayBuffer, {
          onImport: (_url, callback) => callback({ error: new Error('不加载外部资源') }),
        });
        const elements = await doc.render();
        const page = document.createElement('section');
        page.className = 'docx';
        page.style.cssText =
          'width:794px;min-height:900px;padding:56px;box-sizing:border-box;background:white;color:#222;margin:0 auto;font-family:Calibri,Microsoft YaHei,sans-serif';
        page.append(...elements);
        const wrapper = document.createElement('div');
        wrapper.className = 'docx-wrapper';
        wrapper.append(page);
        nodes = [wrapper];
      } else {
        setStatus('正在读取文档结构…');
        const engine = await import('docx-preview');
        const options = {
          useBase64URL: true,
          renderAltChunks: false,
          renderComments: false,
          ignoreLastRenderedPageBreak: true,
        };
        if (parsed.current?.file !== file) {
          const source = await readWordPackage(file, resourceController.current.signal);
          setStatus('正在解析文档结构…');
          await new Promise((resolve) => setTimeout(resolve, 0));
          controller.signal.throwIfAborted();
          const doc = await engine.parseAsync(source.data, options);
          controller.signal.throwIfAborted();
          doc.documentPart.body.children.forEach((child: { className?: string }, index: number) => {
            child.className = `${child.className ?? ''} word-search-block-${index}`;
          });
          parsed.current = { file, doc, source };
        }
        const { source, doc } = parsed.current;
        // Bound the live DOM for book-sized documents. Other sections are rendered on demand.
        const children = doc.documentPart.body.children;
        const count = children.length > 1000 ? Math.ceil(children.length / 200) : 1;
        // Keep the engine's image/font decoding, but supply missing binary parts on demand.
        const originalLoad = doc._package.load.bind(doc._package);
        let failedResources = 0;
        const loadResource = async (path: string, type: string) => {
          const original = await originalLoad(path, type);
          if (original != null) return original;
          try {
            const bytes = await source.resource(path);
            if (!bytes) return null;
            return type === 'blob' ? new Blob([bytes as Uint8Array<ArrayBuffer>]) : bytes;
          } catch (reason) {
            if (controller.signal.aborted) throw reason;
            failedResources++;
            return null;
          }
        };
        const styles = new Set<string>();
        const renderSection = async (index: number, host: HTMLElement) => {
          controller.signal.throwIfAborted();
          const body = {
            ...doc.documentPart.body,
            children: count > 1 ? children.slice(index * 200, (index + 1) * 200) : children,
          };
          // The outline is limited to mounted content; never rescan the full manuscript.
          if (count === 1) {
            headings.push(...buildWordOutline(body, doc.stylesPart?.styles ?? []));
            setOutline(headings);
          }
          const renderDoc = Object.assign(Object.create(Object.getPrototypeOf(doc)), doc, {
            _package: Object.assign(
              Object.create(Object.getPrototypeOf(doc._package)),
              doc._package,
              { load: loadResource },
            ),
            documentPart: Object.assign(
              Object.create(Object.getPrototypeOf(doc.documentPart)),
              doc.documentPart,
              { body },
            ),
          });
          await engine.renderDocument(renderDoc, {
            ...options,
            renderHeaders: count === 1 || index === 0,
            renderFooters: count === 1 || index === count - 1,
            h: wordDom(
              target,
              (wrapper) => {
                if (controller.signal.aborted) return;
                if (count > 1) wrapper.classList.add('word-continuous');
                host.append(wrapper);
                setRendered(true);
                setStatus('');
                // Fit before measuring the placeholder, including sections loaded while scrolling.
                const first = target.querySelector<HTMLElement>('section.docx');
                const fitted = first?.style.zoom;
                wrapper.querySelectorAll<HTMLElement>('section.docx').forEach((page) => {
                  page.style.zoom =
                    fitted ||
                    String(
                      Math.min(
                        1,
                        Math.max(
                          0.2,
                          (frame.current!.clientWidth - horizontalPadding) /
                            parseFloat(getComputedStyle(page).width),
                        ),
                      ),
                    );
                });
              },
              styles,
            ),
          });
        };
        if (count > 1) {
          const continuous = target.createElement('style');
          continuous.textContent = `.word-continuous{padding:0 ${horizontalPadding / 2}px!important;min-height:0!important}.word-continuous>section.docx{margin-bottom:0!important;border-radius:0!important;min-height:0!important;padding-top:0!important;padding-bottom:0!important}[data-word-section="0"] section.docx:first-child{padding-top:56px!important}`;
          target.head.append(continuous);
          mountWordScroll(target, count, renderSection, controller.signal, (error) =>
            setError(documentError('Word', error)),
          );
          return;
        }
        await renderSection(0, target.body);
        nodes = [];
        if (failedResources) setError(`${failedResources} 个图片或字体未能加载，已保留可用页面。`);
      }
      if (controller.signal.aborted) return;
      for (const node of nodes) {
        if (!target.body.contains(node) && !target.head.contains(node)) target.body.append(node);
      }
      setOutline(headings);
      setStatus('');
      setRendered(true);
    };
    void load().catch((e) => {
      if (!controller.signal.aborted) {
        setError(documentError(format === 'rtf' ? 'RTF' : 'Word', e));
        setStatus('');
      }
    });
    return () => controller.abort();
  }, [file, ready, format, macos, horizontalPadding, retry]);
  useEffect(() => {
    if (!rendered) return;
    const apply = () => {
      const doc = frame.current?.contentDocument;
      if (!doc || !frame.current) return;
      const theme = getComputedStyle(document.documentElement);
      doc.body.style.background = theme.getPropertyValue('--office-canvas');
      for (const name of ['--office-canvas', '--scroll-thumb', '--scroll-hover'])
        doc.documentElement.style.setProperty(name, theme.getPropertyValue(name));
      doc.querySelectorAll<HTMLElement>('section.docx').forEach((page) => {
        const width = parseFloat(getComputedStyle(page).width);
        page.style.zoom = String(
          zoom === 'fit'
            ? Math.min(1, Math.max(0.2, (frame.current!.clientWidth - horizontalPadding) / width))
            : Number(zoom),
        );
      });
    };
    apply();
    const resize = new ResizeObserver(apply);
    resize.observe(frame.current!);
    const theme = new MutationObserver(apply);
    theme.observe(document.documentElement, { attributes: true });
    return () => {
      resize.disconnect();
      theme.disconnect();
    };
  }, [zoom, rendered, outline, horizontalPadding]);
  return (
    <ReadingLayout
      loading={!rendered && !error}
      outline={outline}
      activeId={activeId}
      onNavigate={(id) =>
        frame.current?.contentDocument?.querySelector(`.${id}`)?.scrollIntoView({ block: 'start' })
      }
      toolbar={
        <>
          <span className="reading-label">
            {format === 'rtf' ? 'RTF · 富文本预览' : 'Word · 页面预览'}
          </span>
          {pageCount > 0 && (
            <span className="word-page-count" aria-label="文档页数">
              {page} / {pageCount} 页
            </span>
          )}
          <select aria-label="Word 缩放" value={zoom} onChange={(e) => setZoom(e.target.value)}>
            {!['fit', '0.75', '0.9', '1', '1.25', '1.5', '2'].includes(zoom) && (
              <option value={zoom}>{Math.round(Number(zoom) * 100)}%</option>
            )}
            <option value="fit">适应宽度</option>
            <option value="0.75">75%</option>
            <option value="0.9">90%</option>
            <option value="1">100%</option>
            <option value="1.25">125%</option>
            <option value="1.5">150%</option>
            <option value="2">200%</option>
          </select>
          <button onClick={onText}>文字速览</button>
        </>
      }
    >
      <PreviewAdjustmentIndicator
        visible={adjusting}
        label="缩放"
        value={`${Math.round(Number(zoom) * 100)}%`}
      />
      {(status || error) && (
        <div
          className={`word-status ${rendered ? 'word-status-progress' : ''}`}
          role={error ? 'alert' : 'status'}
        >
          {!error && <span className="spinner" />}
          {error || status}
          {error && (
            <>
              <button
                onClick={() => {
                  parsed.current = null;
                  setRetry((value) => value + 1);
                }}
              >
                重新加载
              </button>
              <button onClick={onText}>尝试文字速览</button>
            </>
          )}
        </div>
      )}
      <iframe
        ref={frame}
        title={format === 'rtf' ? 'RTF 富文本预览' : 'Word 原样预览'}
        className="word-frame"
        sandbox="allow-same-origin"
        onLoad={() => setReady(true)}
        srcDoc={
          '<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; img-src data: blob:; font-src data: blob:;"></head><body></body></html>'
        }
      />
    </ReadingLayout>
  );
}
