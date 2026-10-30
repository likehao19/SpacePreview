import PreviewToolbar from './PreviewToolbar';
import { TextAppearanceControls } from './TextAppearance';
import { useEffect, useMemo, useRef, useState } from 'react';
import { trackReadingPosition } from '../lib/reading-position';
import DOMPurify from 'dompurify';
import { List, ChevronLeft, Search, X } from 'lucide-react';
import ReadingWidth from './ReadingWidth';
import { usePreviewState } from './PreviewSession';

export interface OutlineItem {
  id: string;
  title: string;
  level: number;
}
export function ReadingLayout({
  outline,
  onNavigate,
  children,
  toolbar,
  activeId,
  loading = false,
}: {
  outline: OutlineItem[];
  onNavigate: (id: string) => void;
  children: React.ReactNode;
  toolbar?: React.ReactNode;
  activeId?: string;
  loading?: boolean;
}) {
  const [open, setOpen] = usePreviewState('outline.open', () => !/Mac/i.test(navigator.platform));
  const [active, setActive] = useState('');
  const [width, setWidth] = usePreviewState('outline.width', 220);
  const [filter, setFilter] = usePreviewState('outline.filter', '');
  const nav = useRef<HTMLElement>(null);
  const drag = useRef<{ x: number; width: number } | null>(null);
  const current = activeId ?? active;
  const showOutline = open && (outline.length > 0 || loading);
  useEffect(() => {
    const button = nav.current?.querySelector<HTMLElement>('[aria-current="location"]');
    if (!button || !nav.current) return;
    const pane = nav.current.getBoundingClientRect(),
      item = button.getBoundingClientRect();
    if (item.top < pane.top) nav.current.scrollTop += item.top - pane.top - 8;
    else if (item.bottom > pane.bottom) nav.current.scrollTop += item.bottom - pane.bottom + 8;
  }, [current, open, filter]);
  return (
    <div className="reading-view">
      <PreviewToolbar className="reading-tools">
        <button
          className={showOutline ? 'selected' : ''}
          disabled={!outline.length && !loading}
          title="切换文档大纲"
          aria-expanded={showOutline}
          onClick={() => setOpen((v) => !v)}
        >
          <List size={15} /> 大纲
        </button>
        {toolbar}
      </PreviewToolbar>
      <div className="reading-body">
        {showOutline && (
          <aside className="reading-outline" aria-label="文档大纲" style={{ width }}>
            <div className="outline-caption">
              文档大纲 <span>{outline.length}</span>
              <button title="收起大纲" onClick={() => setOpen(false)}>
                <ChevronLeft size={14} />
              </button>
            </div>
            {outline.length > 8 && (
              <label className="outline-search">
                <Search size={13} />
                <input
                  aria-label="搜索文档标题"
                  placeholder="搜索标题"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                />
                {filter && (
                  <button
                    type="button"
                    aria-label="清空目录搜索"
                    title="清空搜索"
                    onClick={(event) => {
                      setFilter('');
                      event.currentTarget.parentElement?.querySelector('input')?.focus();
                    }}
                  >
                    <X size={13} />
                  </button>
                )}
              </label>
            )}
            {loading && !outline.length && (
              <p className="outline-empty" role="status">
                正在读取大纲…
              </p>
            )}
            <nav ref={nav}>
              {outline
                .filter((item) => item.title.toLowerCase().includes(filter.toLowerCase()))
                .map((item) => (
                  <button
                    key={item.id}
                    title={item.title}
                    className={current === item.id ? 'active' : ''}
                    aria-current={current === item.id ? 'location' : undefined}
                    style={{ paddingLeft: 12 + Math.min(item.level - 1, 5) * 12 }}
                    onClick={() => {
                      setActive(item.id);
                      onNavigate(item.id);
                    }}
                  >
                    {item.title}
                  </button>
                ))}
            </nav>
            {filter &&
              !outline.some((item) => item.title.toLowerCase().includes(filter.toLowerCase())) && (
                <p className="outline-empty">没有匹配的标题</p>
              )}
          </aside>
        )}
        {showOutline && (
          <div
            className="outline-resizer"
            role="separator"
            aria-label="调整大纲宽度"
            aria-orientation="vertical"
            aria-valuenow={width}
            aria-valuemin={160}
            aria-valuemax={320}
            tabIndex={0}
            onPointerDown={(e) => {
              drag.current = { x: e.clientX, width };
              e.currentTarget.setPointerCapture(e.pointerId);
              e.preventDefault();
            }}
            onPointerMove={(e) => {
              if (drag.current)
                setWidth(
                  Math.max(160, Math.min(320, drag.current.width + e.clientX - drag.current.x)),
                );
            }}
            onPointerUp={() => {
              drag.current = null;
            }}
            onPointerCancel={() => {
              drag.current = null;
            }}
            onKeyDown={(e) => {
              if (['ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
                e.stopPropagation();
                e.preventDefault();
                if (e.code !== 'Space')
                  setWidth((w) =>
                    Math.max(160, Math.min(320, w + (e.code === 'ArrowRight' ? 16 : -16))),
                  );
              }
            }}
            onKeyUp={(e) => {
              if (['ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.stopPropagation();
            }}
          />
        )}
        <div className="reading-content">{children}</div>
      </div>
    </div>
  );
}

export default function DocumentReader({
  html,
  loading = false,
  note,
  toolbar,
}: {
  html: string;
  loading?: boolean;
  note?: string;
  toolbar?: React.ReactNode;
}) {
  const scroll = useRef<HTMLDivElement>(null);
  const [activeId, setActiveId] = useState('');
  const document = useMemo(() => {
    const safe = DOMPurify.sanitize(html, {
      FORBID_TAGS: [
        'script',
        'style',
        'iframe',
        'object',
        'embed',
        'form',
        'video',
        'audio',
        'link',
        'meta',
        'base',
      ],
      FORBID_ATTR: ['style', 'srcset'],
    });
    const parsed = new DOMParser().parseFromString(safe, 'text/html');
    // Keep self-contained raster images; no tracking or filesystem navigation.
    parsed.querySelectorAll('img').forEach((img) => {
      if (!/^data:image\/(png|jpeg|gif|webp);base64,/i.test(img.getAttribute('src') || ''))
        img.remove();
    });
    parsed.querySelectorAll('input').forEach((input) => {
      if (input.type !== 'checkbox') input.remove();
      else input.disabled = true;
    });
    const anchors = new Map<string, string>();
    const counts = new Map<string, number>();
    const outline = Array.from(parsed.querySelectorAll('h1,h2,h3,h4,h5,h6')).map((heading, i) => {
      const title = heading.textContent?.trim() || '无标题';
      const slug = title
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s_-]/gu, '')
        .replace(/\s/g, '-');
      const count = counts.get(slug) || 0;
      counts.set(slug, count + 1);
      if (heading.id) anchors.set(heading.id, `reader-heading-${i}`);
      anchors.set(count ? `${slug}-${count}` : slug, `reader-heading-${i}`);
      heading.id = `reader-heading-${i}`;
      return { id: heading.id, title, level: Number(heading.tagName[1]) };
    });
    parsed.querySelectorAll('a[href^="#"]').forEach((a) => {
      try {
        const id = anchors.get(decodeURIComponent(a.getAttribute('href')!.slice(1)));
        if (id) a.setAttribute('href', `#${id}`);
      } catch {
        /* Invalid fragment stays inert. */
      }
    });
    return { html: parsed.body.innerHTML, outline };
  }, [html]);
  useEffect(() => {
    if (!scroll.current) return;
    const headings = document.outline.flatMap((item) => {
      const element = scroll.current!.querySelector(`#${item.id}`);
      return element ? [{ id: item.id, element }] : [];
    });
    return trackReadingPosition(scroll.current, headings, setActiveId);
  }, [document]);
  return (
    <ReadingLayout
      loading={loading}
      outline={document.outline}
      activeId={activeId}
      onNavigate={(id) =>
        globalThis.document.getElementById(id)?.scrollIntoView({ block: 'start' })
      }
      toolbar={toolbar}
    >
      <ReadingWidth>
        <div className="document-scroll" ref={scroll}>
          <TextAppearanceControls />
          {note && <div className="document-note">{note}</div>}
          <article
            className="document-paper prose"
            style={{
              fontSize: 'var(--preview-font-size, 16px)',
              fontFamily: 'var(--preview-font-family, var(--font-reading))',
            }}
            onClick={(e) => {
              const anchor = (e.target as HTMLElement).closest('a');
              if (anchor) {
                e.preventDefault();
                const href = anchor.getAttribute('href');
                if (href?.startsWith('#reader-heading-'))
                  globalThis.document
                    .getElementById(href.slice(1))
                    ?.scrollIntoView({ block: 'start' });
              }
            }}
            dangerouslySetInnerHTML={{ __html: document.html }}
          />
        </div>
      </ReadingWidth>
    </ReadingLayout>
  );
}
