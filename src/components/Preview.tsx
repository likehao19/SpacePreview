import ReadingWidth from './ReadingWidth';
import FoldableCode from './FoldableCode';
import { usePreviewPreferences } from './PreviewPreferences';
import PreviewToolbar, { PreviewMenu } from './PreviewToolbar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFileSearch, type SearchHit } from './FileSearch';
import { findText } from '../lib/find';
import { documentError } from '../lib/document-error';
import {
  PreviewAdjustmentIndicator,
  TextAppearanceControls,
  usePreviewGestures,
} from './TextAppearance';
import {
  FileQuestion,
  RotateCw,
  Minus,
  Plus,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  Music2,
  Search,
  List,
  Info,
} from 'lucide-react';
import DOMPurify from 'dompurify';
import type { PDFDocumentProxy, PDFDocumentLoadingTask } from 'pdfjs-dist';
import pdfWorker from '../lib/pdf.worker.ts?worker&url';
import {
  detectKind,
  extension,
  formatSize,
  sniffMagic,
  sniffKind,
  hasBinarySignature,
  unsupportedFormatHint,
  type PreviewFile,
  type PreviewKind,
  type TextEncoding,
} from '../lib/files';
import {
  desktop,
  fileUrl,
  readBytes,
  readRange,
  readFullBytes,
  renderPresentation,
} from '../lib/bridge';
import { readInStages } from '../lib/progressive-read';
import { readStructuredInStages } from '../lib/progressive-office';
import { readOfficeXmlPackage } from '../lib/office-range';
import { parseInWorker } from '../lib/worker-client';
import type { WorkerResult } from '../lib/worker-types';
import type { WorkerRequest } from '../lib/worker-types';
import OfficePreview from './OfficePreview';
import DocumentReader, { ReadingLayout } from './DocumentReader';
import WordPreview from './WordPreview';
import PdfPage from './PdfPage';
import OfdPage, { OFD_PX_PER_MM } from './OfdPage';
import type { OfdDocument } from '../lib/ofd';
import { trackReadingPosition } from '../lib/reading-position';
import ArchivePreview from './ArchivePreview';
import HtmlPreview from './HtmlPreview';
import CadPreview from './CadPreview';
import ModelPreview from './ModelPreview';
import { sourceLanguage } from '../lib/source-languages';
import FileIcon, { fileTypeLabel } from './FileIcon';
import FontPreview from './FontPreview';
import DatabasePreview from './DatabasePreview';
import MailPreview from './MailPreview';
import DiagramPreview from './DiagramPreview';
import AnimationPreview from './AnimationPreview';
import WebArchivePreview from './WebArchivePreview';
import DirectoryPreview from './DirectoryPreview';
import UnsupportedPreview from './UnsupportedPreview';

const MiB = 1024 * 1024;

function useFileUrl(file: PreviewFile) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    const resource = fileUrl(file);
    setUrl(resource.url);
    return resource.dispose;
  }, [file]);
  return url;
}

export default function Preview({
  file,
  mode,
  onOpen,
}: {
  file: PreviewFile;
  mode: 'auto' | 'text' | 'info';
  onOpen: (file: PreviewFile) => void;
}) {
  const registered = detectKind(file.name);
  const textContainer = [
    'docx',
    'legacy-doc',
    'xlsx',
    'legacy-xlsx',
    'pptx',
    'legacy-ppt',
    'odt',
    'ods',
    'odp',
    'epub',
  ].includes(registered);
  const ambiguous = ['dot', 'mdc'].includes(extension(file.name));
  const [detected, setDetected] = useState<PreviewKind | null>(null);
  const [wordText, setWordText] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const { preferences } = usePreviewPreferences();
  const tooLarge = file.size > preferences.maxPreviewMiB * 1024 * 1024;
  useEffect(() => {
    if (tooLarge || file.directory || mode !== 'auto' || (registered !== 'binary' && !ambiguous))
      return;
    let active = true;
    readBytes(file, 16384)
      .then((bytes) => {
        if (active) {
          const sniffed = sniffKind(bytes);
          setDetected(
            extension(file.name) === 'dot'
              ? sniffed === 'text'
                ? 'diagram'
                : 'legacy-doc'
              : extension(file.name) === 'mdc'
                ? sniffed === 'text'
                  ? 'markdown'
                  : 'decoded-image'
                : sniffed,
          );
        }
      })
      .catch(() => {
        if (active) setDetected('binary');
      });
    return () => {
      active = false;
    };
  }, [file, mode, registered, ambiguous, tooLarge]);
  const kind =
    mode === 'info'
      ? 'binary'
      : mode === 'text'
        ? textContainer
          ? registered
          : 'text'
        : registered === 'binary' || ambiguous
          ? detected
          : registered;
  if (file.directory) return <DirectoryPreview key={file.id} file={file} mode={mode} />;
  if (tooLarge && mode !== 'info' && !showInfo)
    return (
      <UnsupportedPreview
        file={file}
        title="文件超过预览上限"
        message={`文件大小 ${formatSize(file.size)}，当前上限 ${preferences.maxPreviewMiB} MB。可在偏好设置中调整。`}
        onInfo={() => setShowInfo(true)}
      />
    );
  if (tooLarge && showInfo) return <BinaryPreview file={file} />;
  if (!kind) return <Loading />;
  if (kind === 'binary' && mode === 'auto' && !showInfo)
    return (
      <UnsupportedPreview
        file={file}
        message={
          unsupportedFormatHint(file.name) ||
          '此文件类型暂不支持内容预览。你可以使用默认应用打开，或查看文件信息。'
        }
        onInfo={() => setShowInfo(true)}
      />
    );
  if (kind === 'html')
    return preferences.html === 'source' ? (
      <ParsedPreview file={file} kind="text" />
    ) : (
      <HtmlPreview file={file} />
    );
  if (kind === 'dxf') return <CadPreview file={file} />;
  if (kind === 'model') return <ModelPreview file={file} />;
  if (kind === 'tiff') return <TiffPreview file={file} />;
  if (kind === 'metafile') return <MetafilePreview file={file} />;
  if (kind === 'decoded-image') return <DecodedImagePreview file={file} />;
  if (kind === 'font') return <FontPreview file={file} />;
  if (kind === 'database') return <DatabasePreview file={file} />;
  if (kind === 'mail') return <MailPreview file={file} onOpen={onOpen} />;
  if (kind === 'diagram') return <DiagramPreview file={file} />;
  if (kind === 'animation') return <AnimationPreview file={file} />;
  if (kind === 'web-archive') return <WebArchivePreview file={file} />;
  if (kind === 'thumbnail') return <DesignPreview file={file} />;
  if (kind === 'rtf')
    return wordText ? (
      <ParsedPreview file={file} kind="text" onLayout={() => setWordText(false)} />
    ) : (
      <WordPreview key={file.id} file={file} format="rtf" onText={() => setWordText(true)} />
    );
  if (kind === 'docx' && !wordText && mode !== 'text')
    return <WordPreview key={file.id} file={file} onText={() => setWordText(true)} />;
  if (kind === 'image') return <ImagePreview file={file} />;
  if (kind === 'pdf') return <PdfPreview file={file} />;
  if (kind === 'ofd') return <OfdPreview key={file.id} file={file} />;
  if (kind === 'pptx' || kind === 'legacy-ppt')
    return mode === 'text' ? (
      <ParsedPreview file={file} kind={kind} />
    ) : (
      <PresentationPreview file={file} />
    );
  if (kind === 'video' || kind === 'audio')
    return <MediaPreview file={file} audio={kind === 'audio'} />;
  if (kind === 'binary') return <BinaryPreview file={file} />;
  if (kind === 'archive') return <ArchivePreview key={file.id} file={file} />;
  return (
    <ParsedPreview
      file={file}
      kind={kind}
      onLayout={kind === 'docx' && mode !== 'text' ? () => setWordText(false) : undefined}
    />
  );
}

function MetafilePreview({ file }: { file: PreviewFile }) {
  const [image, setImage] = useState<PreviewFile>();
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    if (file.size > 16 * MiB) {
      setError('WMF/EMF 预览上限为 16 MB。');
      return;
    }
    void readFullBytes(file, controller.signal)
      .then((bytes) =>
        parseInWorker({ kind: 'metafile', name: file.name, bytes }, controller.signal),
      )
      .then(async (result) => {
        if (controller.signal.aborted) return;
        const svg = await (
          await import('../lib/metafile')
        ).renderMetafile(result.data!, extension(file.name) === 'emf', result.metafile!);
        if (controller.signal.aborted) return;
        const blob = new Blob(
          [DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true, svgFilters: true } })],
          { type: 'image/svg+xml' },
        );
        setImage({
          ...file,
          id: `${file.id}:vector`,
          path: undefined,
          blob,
          size: blob.size,
          mime: 'image/svg+xml',
        });
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [file]);
  return (
    <div className="tiff-preview metafile-preview">
      <PreviewToolbar className="content-toolbar">
        <span>{extension(file.name).toUpperCase()} · GDI 矢量预览</span>
      </PreviewToolbar>
      {error ? (
        <ErrorNotice message={error} />
      ) : image ? (
        <ImagePreview file={image} />
      ) : (
        <Loading />
      )}
    </div>
  );
}

function DesignPreview({ file }: { file: PreviewFile }) {
  const [image, setImage] = useState<PreviewFile>();
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    void import('../lib/design-thumbnail')
      .then(({ designThumbnail }) => designThumbnail(file, controller.signal))
      .then((result) => {
        if (!controller.signal.aborted) setImage(result);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [file]);
  return (
    <>
      <PreviewToolbar className="content-toolbar">
        <span>设计文档 · 内置预览图</span>
      </PreviewToolbar>
      {error ? (
        <ErrorNotice message={error} />
      ) : image ? (
        <ImagePreview file={image} />
      ) : (
        <Loading />
      )}
    </>
  );
}

function ImagePreview({ file }: { file: PreviewFile }) {
  const url = useFileUrl(file);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [size, setSize] = useState('');
  const [error, setError] = useState(false);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const fit = useRef(1);
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const reset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setRotation(0);
  };
  return (
    <div
      className="image-preview checkerboard"
      onWheel={(event) =>
        setZoom((z) => Math.max(0.1, Math.min(8, z * (event.deltaY < 0 ? 1.1 : 0.9))))
      }
      onPointerDown={(event) => {
        if ((event.target as HTMLElement).closest('button')) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { x: event.clientX, y: event.clientY, px: pan.x, py: pan.y };
      }}
      onPointerMove={(event) => {
        if (drag.current)
          setPan({
            x: drag.current.px + event.clientX - drag.current.x,
            y: drag.current.py + event.clientY - drag.current.y,
          });
      }}
      onPointerUp={() => {
        drag.current = null;
      }}
      onPointerCancel={() => {
        drag.current = null;
      }}
      onDoubleClick={() => {
        setZoom(1 / fit.current);
        setPan({ x: 0, y: 0 });
      }}
    >
      {error ? (
        <ErrorNotice message="当前系统无法解码此图片，请切换到文件信息或使用默认应用打开。" />
      ) : (
        url && (
          <img
            draggable={false}
            className="preview-image"
            src={url}
            alt={file.name}
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) rotate(${rotation}deg) scale(${zoom})`,
            }}
            onLoad={(event) => {
              fit.current = event.currentTarget.clientWidth / event.currentTarget.naturalWidth || 1;
              setSize(`${event.currentTarget.naturalWidth} × ${event.currentTarget.naturalHeight}`);
            }}
            onError={() => setError(true)}
          />
        )
      )}
      <PreviewToolbar className="floating-tools">
        <span>{size}</span>
        <i />
        <button title="缩小" onClick={() => setZoom((z) => Math.max(0.1, z - 0.25))}>
          <Minus size={16} />
        </button>
        <button title="重置视图" onClick={reset}>
          {Math.round(zoom * fit.current * 100)}%
        </button>
        <button title="放大" onClick={() => setZoom((z) => Math.min(8, z + 0.25))}>
          <Plus size={16} />
        </button>
        <i />
        <button title="旋转" onClick={() => setRotation((r) => r + 90)}>
          <RotateCw size={16} />
        </button>
      </PreviewToolbar>
    </div>
  );
}

function DecodedImagePreview({ file }: { file: PreviewFile }) {
  const [page, setPage] = useState(0);
  const [pages, setPages] = useState(0);
  const [image, setImage] = useState<PreviewFile>();
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    setImage(undefined);
    setError('');
    void readFullBytes(file, controller.signal)
      .then((bytes) =>
        parseInWorker({ kind: 'decoded-image', bytes, name: file.name, page }, controller.signal),
      )
      .then((result) => {
        if (controller.signal.aborted) return;
        const mime = result.image!.mime ?? 'image/png';
        const blob = new Blob([result.data as Uint8Array<ArrayBuffer>], { type: mime });
        setPages(result.image!.pages);
        setImage({
          ...file,
          id: `${file.id}:${page}`,
          path: undefined,
          blob,
          mime,
          size: blob.size,
        });
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [file, page]);
  return (
    <div className="tiff-preview">
      <PreviewToolbar className="content-toolbar">
        <span>
          {extension(file.name).toUpperCase()} · 第 {page + 1} / {pages || '…'} 页 / 图层
        </span>
        <button disabled={!image || page === 0} onClick={() => setPage((value) => value - 1)}>
          上一页
        </button>
        <button
          disabled={!image || page >= pages - 1}
          onClick={() => setPage((value) => value + 1)}
        >
          下一页
        </button>
      </PreviewToolbar>
      {error ? (
        <ErrorNotice message={error} />
      ) : image ? (
        <ImagePreview key={image.id} file={image} />
      ) : (
        <Loading />
      )}
    </div>
  );
}

function TiffPreview({ file }: { file: PreviewFile }) {
  const [page, setPage] = useState(0);
  const [pages, setPages] = useState(0);
  const [image, setImage] = useState<PreviewFile>();
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    setImage(undefined);
    setError('');
    if (file.size > 32 * MiB) {
      setError('TIFF 文件预览上限为 32 MB。');
      return;
    }
    void readBytes(file, 32 * MiB)
      .then((bytes) =>
        parseInWorker({ kind: 'tiff', bytes, name: file.name, page }, controller.signal),
      )
      .then(async (result) => {
        const raster = result.raster!;
        const canvas = document.createElement('canvas');
        canvas.width = raster.width;
        canvas.height = raster.height;
        canvas
          .getContext('2d')!
          .putImageData(
            new ImageData(new Uint8ClampedArray(raster.pixels), raster.width, raster.height),
            0,
            0,
          );
        const blob = await new Promise<Blob>((resolve, reject) =>
          canvas.toBlob(
            (value) => (value ? resolve(value) : reject(new Error('TIFF 图像转换失败。'))),
            'image/png',
          ),
        );
        if (!controller.signal.aborted) {
          setPages(raster.pages);
          setImage({
            ...file,
            id: `${file.id}:${page}`,
            path: undefined,
            blob,
            mime: 'image/png',
            size: blob.size,
          });
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [file, page]);
  return (
    <div className="tiff-preview">
      <PreviewToolbar className="content-toolbar">
        <span>
          TIFF · 第 {page + 1} / {pages || '…'} 页
        </span>
        <div className="toolbar-right">
          <button disabled={!image || page === 0} onClick={() => setPage((p) => p - 1)}>
            上一页
          </button>
          <button disabled={!image || page >= pages - 1} onClick={() => setPage((p) => p + 1)}>
            下一页
          </button>
        </div>
      </PreviewToolbar>
      {error ? (
        <ErrorNotice message={error} />
      ) : image ? (
        <ImagePreview key={image.id} file={image} />
      ) : (
        <Loading />
      )}
    </div>
  );
}

function PresentationPreview({ file }: { file: PreviewFile }) {
  const available = desktop && !!file.path;
  const [pdf, setPdf] = useState<PreviewFile | null>(null);
  const [text, setText] = useState(!available);
  const [note, setNote] = useState('');
  useEffect(() => {
    let active = true;
    setPdf(null);
    setText(!available);
    setNote(available ? '' : '当前环境提供文字速览；Windows 安装 PowerPoint 后可预览原始页面。');
    if (available) {
      void renderPresentation(file)
        .then((rendered) => {
          if (active) setPdf(rendered);
        })
        .catch((error) => {
          if (active) {
            setNote(String(error));
            setText(true);
          }
        });
    }
    return () => {
      active = false;
    };
  }, [file, available]);
  return (
    <>
      <PreviewMenu>
        <label className="preview-menu-option">
          <span>幻灯片视图</span>
          <select
            aria-label="幻灯片视图"
            value={text ? 'text' : 'pages'}
            onChange={(event) => setText(event.target.value === 'text')}
          >
            <option value="pages" disabled={!available || !!note}>
              原始页面
            </option>
            <option value="text">文字速览</option>
          </select>
        </label>
        {note && (
          <p className="toolbar-summary" role="status">
            {note}
          </p>
        )}
      </PreviewMenu>
      {text ? (
        <ParsedPreview
          file={file}
          kind={detectKind(file.name) === 'legacy-ppt' ? 'legacy-ppt' : 'pptx'}
        />
      ) : pdf ? (
        <PdfPreview file={pdf} presentation />
      ) : (
        <Loading label="正在生成幻灯片页面，首次打开可能需要一点时间…" />
      )}
    </>
  );
}

function PdfPreview({ file, presentation = false }: { file: PreviewFile; presentation?: boolean }) {
  const url = useFileUrl(file);
  const [retry, setRetry] = useState(0);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const adjusting = usePreviewGestures(
    useCallback(
      (direction: number) =>
        setZoom((current) =>
          Math.max(0.1, Math.min(4, Number((current + direction * 0.1).toFixed(2)))),
        ),
      [],
    ),
  );
  const [error, setError] = useState('');
  const scroll = useRef<HTMLDivElement>(null);
  const currentPage = useRef(1);
  const [pageSize, setPageSize] = useState({ width: 684, height: 910 });
  const [fitZoom, setFitZoom] = useState(1);
  const navigate = (number: number) => {
    scroll.current
      ?.querySelector(`[data-pdf-page="${number}"]`)
      ?.scrollIntoView({ block: 'start' });
    currentPage.current = number;
    setPage(number);
  };
  const [panel, setPanel] = useState<'search' | 'outline' | null>(null);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [hits, setHits] = useState<{ page: number; snippet: string }[]>([]);
  const [searchNote, setSearchNote] = useState('');
  const [outline, setOutline] = useState<{ title: string; dest: unknown; depth: number }[]>([]);
  useFileSearch(
    useMemo(
      () =>
        doc
          ? {
              scope: 'PDF 全文',
              async search(query: string, signal: AbortSignal) {
                const matches: SearchHit[] = [];
                for (let number = 1; number <= doc.numPages; number++) {
                  signal.throwIfAborted();
                  const content = await (await doc.getPage(number)).getTextContent();
                  signal.throwIfAborted();
                  const text = content.items
                    .map((item) => ('str' in item ? item.str : ''))
                    .join(' ');
                  if (findText(text, query).length)
                    matches.push({ label: `第 ${number} 页`, goTo: () => navigate(number) });
                }
                return matches;
              },
            }
          : null,
      [doc],
    ),
  );
  useEffect(() => {
    if (!doc || !scroll.current) return;
    // Preserve Windows' normal PDF reading scale; Quick Look fits the full page.
    if (!presentation && document.documentElement.dataset.platform !== 'macos') return;
    const scroller = scroll.current;
    const resize = new ResizeObserver(() =>
      setFitZoom(
        Math.max(
          0.1,
          Math.min(
            (scroller.clientWidth -
              (document.documentElement.dataset.platform === 'macos' ? 16 : 48)) /
              pageSize.width,
            (scroller.clientHeight -
              (document.documentElement.dataset.platform === 'macos' ? 16 : 48)) /
              pageSize.height,
          ),
        ),
      ),
    );
    resize.observe(scroller);
    return () => resize.disconnect();
  }, [presentation, doc, pageSize]);
  useEffect(() => {
    let cancelled = false;
    if (!doc) return;
    void doc
      .getOutline()
      .then((items) => {
        const flat: { title: string; dest: unknown; depth: number }[] = [];
        const collect = (nodes: NonNullable<typeof items>, depth: number) => {
          for (const node of nodes) {
            if (flat.length >= 1000 || depth > 20) break;
            flat.push({ title: node.title, dest: node.dest, depth });
            collect(node.items, depth + 1);
          }
        };
        if (items) collect(items, 0);
        if (!cancelled) setOutline(flat);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [doc]);
  useEffect(() => {
    let cancelled = false;
    setHits([]);
    setSearchNote('');
    setSearching(false);
    if (!doc || !query.trim()) return;
    const timer = setTimeout(async () => {
      setSearching(true);
      const found: { page: number; snippet: string }[] = [];
      const deadline = performance.now() + 10_000;
      try {
        for (let number = 1; number <= doc.numPages && number <= 1000; number++) {
          if (cancelled) return;
          if (performance.now() > deadline) {
            setSearchNote('搜索达到 10 秒上限，已保留找到的结果。');
            break;
          }
          const pdfPage = await doc.getPage(number);
          const content = await pdfPage.getTextContent();
          const text = content.items.map((item) => ('str' in item ? item.str : '')).join(' ');
          const position = text.toLowerCase().indexOf(query.trim().toLowerCase());
          if (position >= 0) {
            found.push({
              page: number,
              snippet: text.slice(Math.max(0, position - 22), position + query.length + 55),
            });
            if (!cancelled) setHits([...found]);
          }
        }
        if (!cancelled && doc.numPages > 1000) setSearchNote('只搜索前 1,000 页。');
      } catch {
        if (!cancelled) setSearchNote('部分页面无法提取文字。');
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [doc, query]);
  const goToDestination = async (destination: unknown) => {
    if (!doc) return;
    try {
      const resolved =
        typeof destination === 'string' ? await doc.getDestination(destination) : destination;
      if (Array.isArray(resolved) && resolved.length) {
        const ref = resolved[0];
        const number = typeof ref === 'number' ? ref : await doc.getPageIndex(ref);
        navigate(Math.max(1, Math.min(doc.numPages, number + 1)));
      }
    } catch {
      setSearchNote('无法跳转到此目录项。');
    }
  };
  useEffect(() => {
    setError('');
    setDoc(null);
    setOutline([]);
    setPage(1);
    currentPage.current = 1;
    if (!url) return;
    let task: PDFDocumentLoadingTask | undefined;
    let cancelled = false;
    void import('../lib/pdf-compat')
      .then(() => import('pdfjs-dist/legacy/build/pdf.mjs'))
      .then((pdf) => {
        if (cancelled) return;
        pdf.GlobalWorkerOptions.workerSrc = pdfWorker;
        task = pdf.getDocument({
          url,
          disableAutoFetch: true,
          disableStream: true,
          cMapUrl: `${import.meta.env.BASE_URL}pdfjs/cmaps/`,
          cMapPacked: true,
          standardFontDataUrl: `${import.meta.env.BASE_URL}pdfjs/standard_fonts/`,
          wasmUrl: `${import.meta.env.BASE_URL}pdfjs/wasm/`,
          iccUrl: `${import.meta.env.BASE_URL}pdfjs/iccs/`,
        });
        return task.promise.then(async (document) => {
          const first = await document.getPage(1);
          const size = first.getViewport({ scale: 1.15 });
          if (!cancelled) {
            setPageSize({ width: size.width, height: size.height });
            setDoc(document);
          }
        });
      })
      .catch((reason) => {
        if (!cancelled) setError(documentError('PDF', reason));
      });
    return () => {
      cancelled = true;
      void task?.destroy();
    };
  }, [url, retry]);
  useEffect(() => {
    if (!doc || !scroll.current) return;
    const scroller = scroll.current;
    return trackReadingPosition(
      scroller,
      Array.from(scroller.querySelectorAll('[data-pdf-page]')).map((element) => ({
        id: element.getAttribute('data-pdf-page')!,
        element,
      })),
      (id) => {
        currentPage.current = Number(id) || 1;
        setPage(currentPage.current);
      },
    );
  }, [doc]);
  useEffect(() => {
    scroll.current
      ?.querySelector(`[data-pdf-page="${currentPage.current}"]`)
      ?.scrollIntoView({ block: 'start' });
  }, [zoom, fitZoom]);
  return (
    <div
      className="pdf-preview"
      data-page-width={doc ? pageSize.width : undefined}
      data-page-height={doc ? pageSize.height : undefined}
    >
      <PreviewAdjustmentIndicator
        visible={adjusting}
        label="缩放"
        value={`${Math.round(zoom * 100)}%`}
      />
      {error ? (
        <ErrorNotice message={error} onRetry={() => setRetry((value) => value + 1)} />
      ) : (
        <>
          <PreviewToolbar className="content-toolbar pdf-toolbar">
            <span className="toolbar-summary">
              {presentation ? '幻灯片原始页面' : 'PDF'} · {doc?.numPages ?? '…'} 页
            </span>
            <div className="toolbar-right">
              <button
                title="搜索 PDF"
                onClick={() => setPanel((p) => (p === 'search' ? null : 'search'))}
              >
                <Search size={15} /> 搜索
              </button>
              <button
                title="PDF 目录"
                onClick={() => setPanel((p) => (p === 'outline' ? null : 'outline'))}
              >
                <List size={15} /> 目录
              </button>
            </div>
          </PreviewToolbar>
          <div className="pdf-body">
            {panel && (
              <aside className="pdf-sidebar">
                {panel === 'search' ? (
                  <>
                    <label className="search">
                      <Search size={14} />
                      <input
                        autoFocus
                        aria-label="搜索 PDF 内容"
                        placeholder="输入关键词"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                    </label>
                    <p>
                      {searching
                        ? '正在逐页搜索…'
                        : query
                          ? `${hits.length} 个匹配页面`
                          : '搜索文档中的文字'}
                    </p>
                    {hits.map((hit) => (
                      <button key={hit.page} onClick={() => navigate(hit.page)}>
                        <strong>第 {hit.page} 页</strong>
                        <span>{hit.snippet}</span>
                      </button>
                    ))}
                    {searchNote && <p>{searchNote}</p>}
                  </>
                ) : (
                  <>
                    {!outline.length && <p>此 PDF 没有内置目录。</p>}
                    {outline.map((item, index) => (
                      <button
                        key={index}
                        style={{ paddingLeft: 12 + item.depth * 12 }}
                        disabled={!item.dest}
                        onClick={() => void goToDestination(item.dest)}
                      >
                        {item.title}
                      </button>
                    ))}
                  </>
                )}
              </aside>
            )}
            <div className="pdf-scroll" ref={scroll}>
              {!doc ? (
                <Loading />
              ) : (
                Array.from({ length: doc.numPages }, (_, index) => (
                  <PdfPage
                    key={index + 1}
                    doc={doc}
                    number={index + 1}
                    zoom={zoom * fitZoom}
                    initialSize={pageSize}
                  />
                ))
              )}
            </div>
          </div>
          <PreviewToolbar className="floating-tools">
            <button title="上一页" disabled={page <= 1} onClick={() => navigate(page - 1)}>
              <ChevronLeft size={16} />
            </button>
            <span aria-label="PDF 当前页">
              {page} / {doc?.numPages ?? '…'}
            </span>
            <button
              title="下一页"
              disabled={!doc || page >= doc.numPages}
              onClick={() => navigate(page + 1)}
            >
              <ChevronRight size={16} />
            </button>
            <i />
            <button title="缩小" onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))}>
              <Minus size={16} />
            </button>
            <span>{Math.round(zoom * 100)}%</span>
            {presentation && (
              <button title="适应窗口" onClick={() => setZoom(1)}>
                <Maximize2 size={16} />
              </button>
            )}
            <button title="放大" onClick={() => setZoom((z) => Math.min(3, z + 0.25))}>
              <Plus size={16} />
            </button>
          </PreviewToolbar>
        </>
      )}
    </div>
  );
}

function OfdPreview({ file }: { file: PreviewFile }) {
  const [doc, setDoc] = useState<OfdDocument | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [fitZoom, setFitZoom] = useState(1);
  const scroll = useRef<HTMLDivElement>(null);
  const currentPage = useRef(1);
  const adjusting = usePreviewGestures(
    useCallback(
      (direction: number) =>
        setZoom((current) =>
          Math.max(0.1, Math.min(4, Number((current + direction * 0.1).toFixed(2)))),
        ),
      [],
    ),
  );
  const navigate = (number: number) => {
    scroll.current
      ?.querySelector(`[data-pdf-page="${number}"]`)
      ?.scrollIntoView({ block: 'start' });
    currentPage.current = number;
    setPage(number);
  };
  useFileSearch(
    useMemo(
      () =>
        doc
          ? {
              scope: 'OFD 全文',
              async search(query: string, signal: AbortSignal) {
                const matches: SearchHit[] = [];
                for (let index = 0; index < doc.pages.length && index < 1000; index++) {
                  signal.throwIfAborted();
                  const text = await doc.pageText(index).catch(() => '');
                  if (findText(text, query).length)
                    matches.push({ label: `第 ${index + 1} 页`, goTo: () => navigate(index + 1) });
                }
                return matches;
              },
            }
          : null,
      [doc],
    ),
  );
  useEffect(() => {
    const controller = new AbortController();
    let opened: OfdDocument | undefined;
    setDoc(null);
    setError('');
    setPage(1);
    currentPage.current = 1;
    void import('../lib/ofd')
      .then(({ openOfd }) =>
        openOfd({
          size: file.size,
          read: async (offset, length) => {
            controller.signal.throwIfAborted();
            return readRange(file, offset, length);
          },
          signal: controller.signal,
          worker: true,
        }),
      )
      .then((document) => {
        if (controller.signal.aborted) return document.close();
        opened = document;
        setDoc(document);
      })
      .catch((reason) => {
        if (!controller.signal.aborted) setError(documentError('OFD', reason));
      });
    return () => {
      controller.abort();
      opened?.close();
    };
  }, [file, retry]);
  useEffect(() => {
    if (!doc || !scroll.current || document.documentElement.dataset.platform !== 'macos') return;
    // Quick Look on macOS fits the whole page, matching the PDF reader.
    const scroller = scroll.current;
    const resize = new ResizeObserver(() =>
      setFitZoom(
        Math.max(
          0.1,
          Math.min(
            (scroller.clientWidth - 16) / (doc.box[2] * OFD_PX_PER_MM),
            (scroller.clientHeight - 16) / (doc.box[3] * OFD_PX_PER_MM),
          ),
        ),
      ),
    );
    resize.observe(scroller);
    return () => resize.disconnect();
  }, [doc]);
  useEffect(() => {
    if (!doc || !scroll.current) return;
    const scroller = scroll.current;
    return trackReadingPosition(
      scroller,
      Array.from(scroller.querySelectorAll('[data-pdf-page]')).map((element) => ({
        id: element.getAttribute('data-pdf-page')!,
        element,
      })),
      (id) => {
        currentPage.current = Number(id) || 1;
        setPage(currentPage.current);
      },
    );
  }, [doc]);
  useEffect(() => {
    scroll.current
      ?.querySelector(`[data-pdf-page="${currentPage.current}"]`)
      ?.scrollIntoView({ block: 'start' });
  }, [zoom, fitZoom]);
  const count = doc?.pages.length;
  return (
    <div
      className="pdf-preview ofd-preview"
      data-page-width={doc ? doc.box[2] * OFD_PX_PER_MM : undefined}
      data-page-height={doc ? doc.box[3] * OFD_PX_PER_MM : undefined}
    >
      <PreviewAdjustmentIndicator
        visible={adjusting}
        label="缩放"
        value={`${Math.round(zoom * 100)}%`}
      />
      {error ? (
        <ErrorNotice message={error} onRetry={() => setRetry((value) => value + 1)} />
      ) : (
        <>
          <PreviewToolbar className="content-toolbar pdf-toolbar">
            <span className="toolbar-summary">
              OFD 版式文档 · {doc && doc.documents > 1 ? `${doc.documents} 份文档 · ` : ''}
              {count ?? '…'} 页
            </span>
          </PreviewToolbar>
          <div className="pdf-body">
            <div className="pdf-scroll" ref={scroll}>
              {!doc ? (
                <Loading />
              ) : (
                doc.pages.map((item, index) => (
                  <OfdPage key={item.path} doc={doc} index={index} zoom={zoom * fitZoom} />
                ))
              )}
            </div>
          </div>
          <PreviewToolbar className="floating-tools">
            <button title="上一页" disabled={page <= 1} onClick={() => navigate(page - 1)}>
              <ChevronLeft size={16} />
            </button>
            <span aria-label="OFD 当前页">
              {page} / {count ?? '…'}
            </span>
            <button
              title="下一页"
              disabled={!count || page >= count}
              onClick={() => navigate(page + 1)}
            >
              <ChevronRight size={16} />
            </button>
            <i />
            <button title="缩小" onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))}>
              <Minus size={16} />
            </button>
            <span>{Math.round(zoom * 100)}%</span>
            <button title="放大" onClick={() => setZoom((z) => Math.min(3, z + 0.25))}>
              <Plus size={16} />
            </button>
          </PreviewToolbar>
        </>
      )}
    </div>
  );
}

function MediaPreview({ file, audio }: { file: PreviewFile; audio: boolean }) {
  const url = useFileUrl(file);
  const player = useRef<HTMLMediaElement>(null);
  useEffect(() => {
    const media = player.current;
    return () => {
      if (!media) return;
      media.pause();
      media.removeAttribute('src');
      media.load();
    };
  }, [url]);
  const [error, setError] = useState(false);
  return (
    <div className={`media-preview ${audio ? 'audio-preview' : ''}`}>
      {error ? (
        <ErrorNotice message="当前系统不支持此音视频编码。可以使用默认应用打开。" />
      ) : audio ? (
        <>
          <div className="record">
            <Music2 size={44} />
          </div>
          <h2>{file.name}</h2>
          <p>停下来，听一会儿。</p>
          {url && (
            <audio
              ref={player as React.RefObject<HTMLAudioElement | null>}
              autoPlay
              controls
              src={url}
              onError={() => setError(true)}
            />
          )}
        </>
      ) : (
        url && (
          <video
            ref={player as React.RefObject<HTMLVideoElement | null>}
            autoPlay
            controls
            playsInline
            src={url}
            onError={() => setError(true)}
          />
        )
      )}
    </div>
  );
}

function ParsedPreview({
  file,
  kind,
  onLayout,
}: {
  file: PreviewFile;
  kind: Exclude<
    WorkerRequest['kind'],
    'archive-entry' | 'archive-directory' | 'archive-data' | 'docx-layout'
  >;
  onLayout?: () => void;
}) {
  const [result, setResult] = useState<WorkerResult | null>(null);
  const [progress, setProgress] = useState(0);
  const [backgroundLoading, setBackgroundLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  const [binary, setBinary] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const plainText =
    sourceLanguage(file.name) === 'plaintext' &&
    ['txt', 'text', 'dat', 'license', 'readme'].includes(extension(file.name));
  const { preferences } = usePreviewPreferences();
  const wrap = preferences.wrap;
  const [encodingOverride, setEncoding] = useState<TextEncoding | null>(null);
  const encoding = encodingOverride ?? preferences.encoding;
  const continuousCode = useRef<HTMLElement>(null);
  useEffect(() => {
    const code = continuousCode.current;
    if (!code || !query || !CSS.highlights || typeof Highlight === 'undefined') return;
    const highlight = new Highlight();
    const walker = document.createTreeWalker(code, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode() as Text | null;
    let offset = 0;
    const locate = (position: number): [Text, number] | undefined => {
      while (node && offset + node.length < position) {
        offset += node.length;
        node = walker.nextNode() as Text | null;
      }
      if (node) return [node, position - offset];
    };
    const pattern = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    for (const match of (code.textContent ?? '').matchAll(pattern)) {
      const start = locate(match.index);
      const end = locate(match.index + match[0].length);
      if (start && end) {
        const range = document.createRange();
        range.setStart(...start);
        range.setEnd(...end);
        highlight.add(range);
      }
    }
    CSS.highlights.set('text-search', highlight);
    return () => {
      if (CSS.highlights.get('text-search') === highlight) CSS.highlights.delete('text-search');
    };
  }, [query, result]);
  const container = [
    'archive',
    'docx',
    'xlsx',
    'pptx',
    'odt',
    'ods',
    'odp',
    'epub',
    'fb2',
    'notebook',
  ].includes(kind);
  const limit = ['fb2', 'notebook'].includes(kind) ? 8 * MiB : container ? 32 * MiB : 512 * 1024;
  useEffect(() => {
    const controller = new AbortController();
    setError('');
    setResult(null);
    setBinary(false);
    setProgress(0);
    setBackgroundLoading(false);
    const stagedText =
      file.size > 512 * 1024 && ['text', 'markdown', 'csv', 'asciidoc'].includes(kind);
    const stagedOffice = file.size > MiB && ['xlsx', 'pptx', 'epub'].includes(kind);
    const largeOffice =
      file.size > limit && ['docx', 'xlsx', 'pptx', 'odt', 'ods', 'odp'].includes(kind);
    if (file.size > limit && container && !largeOffice && !stagedOffice) {
      setError(`此格式的快速预览上限为 ${limit / MiB} MB，请切换到文件信息或默认应用。`);
      return;
    }
    const load = async () => {
      if (kind === 'text') {
        const prefix = await readBytes(file, 16384);
        controller.signal.throwIfAborted();
        const registered = detectKind(file.name);
        const textSource = [
          'text',
          'markdown',
          'html',
          'rtf',
          'asciidoc',
          'fb2',
          'notebook',
          'diagram',
        ].includes(registered);
        if (
          hasBinarySignature(prefix) ||
          (!textSource && !['text', 'html', 'rtf'].includes(sniffKind(prefix)))
        ) {
          setBinary(true);
          return;
        }
      }
      if (stagedText) {
        setBackgroundLoading(true);
        await readInStages(
          file.size,
          (offset, length) => readRange(file, offset, length),
          controller.signal,
          async (bytes, complete) => {
            const value = await parseInWorker(
              { kind, name: file.name, bytes, encoding, partial: !complete },
              controller.signal,
            );
            if (!controller.signal.aborted) setResult(value);
          },
          setProgress,
        );
        return;
      }
      if (stagedOffice) {
        setBackgroundLoading(true);
        await readStructuredInStages(
          file,
          kind as 'xlsx' | 'pptx' | 'epub',
          controller.signal,
          setResult,
          setProgress,
        );
        return;
      }
      const bytes = await (largeOffice
        ? readOfficeXmlPackage(file, controller.signal)
        : [
              'text',
              'markdown',
              'html',
              'csv',
              'asciidoc',
              'legacy-xlsx',
              'legacy-doc',
              'legacy-ppt',
            ].includes(kind)
          ? readFullBytes(file, controller.signal, setProgress)
          : readBytes(file, limit));
      const value = await parseInWorker(
        { kind, name: file.name, bytes, encoding, progressive: file.size > 512 * 1024 },
        controller.signal,
        (value) => {
          setBackgroundLoading(true);
          setResult(value);
        },
      );
      if (!controller.signal.aborted) setResult(value);
    };
    void load()
      .catch((e) => {
        if (!controller.signal.aborted) setError(String(e.message ?? e));
      })
      .finally(() => {
        if (!controller.signal.aborted) setBackgroundLoading(false);
      });
    return () => controller.abort();
  }, [file, kind, limit, container, encoding, retry]);
  if (error && !result) return <ErrorNotice message={error} />;
  if (binary) return <BinaryPreview file={file} textFallback />;
  if (!result)
    return [
      'markdown',
      'docx',
      'odt',
      'html',
      'fb2',
      'notebook',
      'asciidoc',
      'legacy-doc',
    ].includes(kind) ? (
      <ReadingLayout outline={[]} loading onNavigate={() => {}}>
        <Loading progress={progress} />
      </ReadingLayout>
    ) : (
      <Loading progress={progress} />
    );
  const loadingStatus = (backgroundLoading || error) && (
    <div className="progressive-status" role={error ? 'alert' : 'status'}>
      {!error && <span className="spinner" />}
      <span>
        {error
          ? `后续内容加载失败：${error}`
          : `后续内容加载中… ${progress}% · 当前仅显示已加载内容`}
      </span>
      {error && <button onClick={() => setRetry((value) => value + 1)}>重新加载</button>}
    </div>
  );
  if (result.sheets || result.slides)
    return (
      <>
        {loadingStatus}
        <OfficePreview result={result} />
      </>
    );
  if (result.chapters)
    return (
      <>
        {loadingStatus}
        <BookPreview chapters={result.chapters} />
      </>
    );
  const encodingControl = (
    <PreviewMenu>
      <label className="preview-menu-option">
        <span>当前文件编码</span>
        <select
          aria-label="文本编码"
          value={encoding}
          onChange={(e) => setEncoding(e.target.value as TextEncoding)}
        >
          {(
            [
              'auto',
              'utf-8',
              'utf-16le',
              'utf-16be',
              'gb18030',
              'big5',
              'windows-1252',
              'shift_jis',
            ] as const
          ).map((value) => (
            <option key={value} value={value}>
              {value === 'auto'
                ? '自动编码'
                : value === 'gb18030'
                  ? 'GB18030 / GBK'
                  : value.toUpperCase()}
            </option>
          ))}
        </select>
      </label>
    </PreviewMenu>
  );
  if (
    ['markdown', 'docx', 'odt', 'html', 'fb2', 'notebook', 'asciidoc', 'legacy-doc'].includes(kind)
  ) {
    // Block active content and remote images; documents cannot fetch tracking resources.
    return (
      <>
        {loadingStatus}
        <DocumentReader
          loading={backgroundLoading}
          html={result.html ?? ''}
          toolbar={
            <>
              <span className="reading-label">
                {kind === 'legacy-doc'
                  ? result.note
                  : kind === 'markdown'
                    ? 'Markdown'
                    : kind === 'html'
                      ? 'HTML · 安全阅读'
                      : kind === 'fb2'
                        ? 'FB2 · 电子书'
                        : kind === 'notebook'
                          ? 'Jupyter Notebook'
                          : '文档 · 文字速览'}
              </span>
              {!container && encodingControl}
              {onLayout && <button onClick={onLayout}>页面预览</button>}
            </>
          }
          note={
            result.note ||
            (container && file.size > limit ? '大文档文字速览 · 按需读取 XML，跳过图片' : undefined)
          }
        />
      </>
    );
  }
  const continuous = file.size > 512 * 1024 || (result.lines ?? 0) > 5000;
  const matching = new Set<number>();
  if (query)
    (result.text ?? '').split('\n').forEach((line, i) => {
      if (line.toLowerCase().includes(query.toLowerCase())) matching.add(i);
    });
  return (
    <div className={`text-preview ${plainText ? 'plain-text' : 'source-code'}`}>
      {loadingStatus}
      <TextAppearanceControls />
      <PreviewToolbar className="content-toolbar">
        <span className="toolbar-summary">
          {result.encoding}
          <b>·</b>
          {result.language}
          <b>·</b>
          {result.lines} 行{result.truncated ? ' · 内容已截断' : ''}
        </span>
        <div className="toolbar-right">
          {onLayout && <button onClick={onLayout}>页面预览</button>}
          {encodingControl}
          <label className="search">
            <Search size={14} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="查找文本"
              aria-label="查找文本"
            />
            {query && <small>{matching.size}</small>}
          </label>
        </div>
      </PreviewToolbar>
      <div className={`code-scroll ${wrap ? 'wrap' : ''}`}>
        <ReadingWidth kind={plainText ? 'text' : 'code'}>
          {continuous ? (
            <pre className="continuous-pre">
              {!wrap && (
                <span className="continuous-line-numbers" aria-hidden="true">
                  {Array.from({ length: result.lines ?? 1 }, (_, i) => i + 1).join('\n')}
                </span>
              )}
              <code
                ref={continuousCode}
                className="continuous-content"
                dangerouslySetInnerHTML={{ __html: result.html || ' ' }}
              />
            </pre>
          ) : (
            <FoldableCode
              html={result.html ?? ''}
              text={result.text ?? ''}
              language={result.language ?? sourceLanguage(file.name)}
              query={query}
            />
          )}
        </ReadingWidth>
      </div>
    </div>
  );
}

function BookPreview({ chapters }: { chapters: NonNullable<WorkerResult['chapters']> }) {
  const [index, setIndex] = useState(0);
  useFileSearch(
    useMemo(
      () => ({
        scope: '电子书正文',
        search: (query: string) =>
          chapters.flatMap((chapter, chapterIndex) => {
            const text =
              new DOMParser().parseFromString(chapter.html, 'text/html').body.textContent ?? '';
            return findText(text, query).length
              ? [{ label: chapter.title, goTo: () => setIndex(chapterIndex) }]
              : [];
          }),
      }),
      [chapters],
    ),
  );
  const chapter = chapters[index];
  return (
    <div className="book-preview">
      <TextAppearanceControls />
      <PreviewToolbar className="content-toolbar">
        <select
          aria-label="选择电子书章节"
          value={index}
          onChange={(e) => setIndex(Number(e.target.value))}
        >
          {chapters.map((chapter, i) => (
            <option key={i} value={i}>
              {i + 1}. {chapter.title}
            </option>
          ))}
        </select>
        <span>
          {index + 1} / {chapters.length} 章 · 文字速览
        </span>
      </PreviewToolbar>
      <div className="document-scroll" key={index}>
        <article
          className="document-paper prose"
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(chapter?.html ?? '') }}
        />
      </div>
    </div>
  );
}

function BinaryPreview({
  file,
  textFallback = false,
}: {
  file: PreviewFile;
  textFallback?: boolean;
}) {
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [error, setError] = useState('');
  const [shown, setShown] = useState(128);
  useEffect(() => {
    let active = true;
    readBytes(file, 512)
      .then((b) => {
        if (active) setBytes(b);
      })
      .catch((e) => {
        if (active) setError(String(e));
      });
    return () => {
      active = false;
    };
  }, [file]);
  if (error) return <ErrorNotice message={error} />;
  return (
    <div className="binary-preview">
      <div className="binary-summary">
        <FileIcon name={file.name} path={file.path} size={72} />
        <div className="binary-heading">
          <span className="binary-type-badge">{fileTypeLabel(file.name)}</span>
          <h2>{file.name}</h2>
          <p>{bytes ? sniffMagic(bytes) : '读取文件信息…'}</p>
        </div>
      </div>
      <dl className="metadata">
        <div>
          <dt>文件大小</dt>
          <dd>{formatSize(file.size)}</dd>
        </div>
        <div>
          <dt>MIME</dt>
          <dd>{file.mime || 'application/octet-stream'}</dd>
        </div>
        <div>
          <dt>修改时间</dt>
          <dd>{new Date(file.modified).toLocaleString('zh-CN')}</dd>
        </div>
        <div>
          <dt>文件签名</dt>
          <dd className="mono">
            {bytes
              ? Array.from(bytes.slice(0, 8), (b) =>
                  b.toString(16).padStart(2, '0').toUpperCase(),
                ).join(' ') || '空文件'
              : '…'}
          </dd>
        </div>
      </dl>
      <div className="hex-title">
        <strong>字节内容</strong>
        <div className="hex-options">
          {[128, 512].map((count) => (
            <button
              key={count}
              className={shown === count ? 'selected' : ''}
              aria-pressed={shown === count}
              onClick={() => setShown(count)}
            >
              {count} 字节
            </button>
          ))}
        </div>
      </div>
      <div className="hex-legend">
        <span className="hex-signature">文件签名</span>
        <span className="hex-printable">可读字符</span>
        <span className="hex-zero">空字节</span>
        <span>前 {bytes ? Math.min(shown, bytes.length) : shown} 字节 · 只读</span>
      </div>
      <div className="hex hex-grid" aria-label="十六进制文件内容">
        <div className="hex-row hex-column-heading">
          <span>偏移</span>
          <span>
            {Array.from({ length: 16 }, (_, i) => (
              <b key={i}>{i.toString(16).toUpperCase().padStart(2, '0')}</b>
            ))}
          </span>
          <span>ASCII</span>
        </div>
        {bytes ? (
          bytes.length ? (
            Array.from({ length: Math.ceil(Math.min(bytes.length, shown) / 16) }, (_, row) => {
              const part = bytes.slice(row * 16, Math.min(row * 16 + 16, shown));
              return (
                <div className="hex-row" key={row}>
                  <span className="hex-offset">
                    {(row * 16).toString(16).toUpperCase().padStart(8, '0')}
                  </span>
                  <span className="hex-bytes">
                    {Array.from({ length: 16 }, (_, col) => {
                      const value = part[col],
                        offset = row * 16 + col;
                      return (
                        <span
                          key={col}
                          className={
                            value === undefined
                              ? ''
                              : offset < 8
                                ? 'hex-signature'
                                : value === 0
                                  ? 'hex-zero'
                                  : value >= 32 && value <= 126
                                    ? 'hex-printable'
                                    : 'hex-control'
                          }
                          title={
                            value === undefined ? undefined : `偏移 ${offset} · 十进制 ${value}`
                          }
                        >
                          {value === undefined
                            ? '  '
                            : value.toString(16).toUpperCase().padStart(2, '0')}
                        </span>
                      );
                    })}
                  </span>
                  <span className="hex-ascii">
                    {Array.from(part, (value) =>
                      value >= 32 && value <= 126 ? String.fromCharCode(value) : '·',
                    ).join('')}
                  </span>
                </div>
              );
            })
          ) : (
            <p>此文件为空。</p>
          )
        ) : (
          <p>读取中…</p>
        )}
      </div>
      <p className="binary-hint">
        <Info size={16} />
        {textFallback
          ? '检测到二进制内容，已显示文件信息和字节预览；此文件无法按纯文本阅读。'
          : unsupportedFormatHint(file.name) || (
              <>
                此格式尚未支持内容预览。确认它是文本时，可用 <kbd>Shift</kbd> + 预览快捷键查看。
              </>
            )}
      </p>
    </div>
  );
}

function Loading({ progress, label }: { progress?: number; label?: string } = {}) {
  return (
    <div className="preview-message" role="status" aria-live="polite">
      <span className="spinner" />
      <p>
        {label ??
          (progress === undefined
            ? '正在准备预览…'
            : progress < 100
              ? `正在加载完整文件… ${progress}%`
              : '正在解析完整内容…')}
      </p>
    </div>
  );
}
function ErrorNotice({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="preview-message">
      <FileQuestion size={36} />
      <h3>暂时无法渲染这个文件</h3>
      <p>{message}</p>
      {onRetry && <button onClick={onRetry}>重新加载</button>}
    </div>
  );
}
