import PreviewToolbar from './PreviewToolbar';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useFileSearch, type SearchHit } from './FileSearch';
import { findText } from '../lib/find';
import { ChevronLeft, ChevronRight, Table2 } from 'lucide-react';
import type { WorkerResult } from '../lib/worker-types';
import { usePreviewState } from './PreviewSession';
import { TextAppearanceControls, useTextAppearance } from './TextAppearance';

function columnName(index: number): string {
  let name = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26))
    name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  return name;
}
export default function OfficePreview({ result }: { result: WorkerResult }) {
  const { size } = useTextAppearance();
  const rowHeight = Math.max(32, Math.ceil(size * 1.5 + 8));
  const [selected, setSelected] = usePreviewState('office.selected', 0);
  const [start, setStart] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);
  const previousHeight = useRef(rowHeight);
  const scrollPosition = useRef(0);
  useFileSearch(
    useMemo(
      () => ({
        scope: result.sheets ? '工作簿单元格' : '幻灯片正文',
        async search(query: string, signal: AbortSignal) {
          const matches: SearchHit[] = [];
          for (let sheetIndex = 0; sheetIndex < (result.sheets?.length ?? 0); sheetIndex++) {
            const sheet = result.sheets![sheetIndex];
            for (let row = 0; row < sheet.rows.length; row++) {
              signal.throwIfAborted();
              sheet.rows[row].forEach((cell, col) => {
                if (!findText(cell, query).length) return;
                matches.push({
                  label: `${sheet.name}!${columnName(col)}${row + 1}`,
                  goTo: async (navigationSignal) => {
                    setSelected(sheetIndex);
                    setStart(Math.max(0, row - 3));
                    await new Promise((resolve) => requestAnimationFrame(resolve));
                    if (navigationSignal.aborted || !scroller.current) return;
                    scroller.current.scrollTop = row * rowHeight;
                    await new Promise((resolve) => requestAnimationFrame(resolve));
                    if (!navigationSignal.aborted)
                      scroller.current
                        ?.querySelector(`[data-search-row="${row}"][data-search-column="${col}"]`)
                        ?.scrollIntoView({ block: 'center', inline: 'center' });
                  },
                });
              });
              if (row % 500 === 499) await new Promise((resolve) => setTimeout(resolve, 0));
            }
          }
          result.slides?.forEach((slide, slideIndex) => {
            if (findText([slide.title, ...slide.paragraphs].join('\n'), query).length)
              matches.push({
                label: `第 ${slideIndex + 1} 张`,
                goTo: () => setSelected(slideIndex),
              });
          });
          return matches;
        },
      }),
      [result, rowHeight],
    ),
  );
  useLayoutEffect(() => {
    if (scroller.current && rowHeight !== previousHeight.current) {
      scroller.current.scrollTop = (scrollPosition.current / previousHeight.current) * rowHeight;
      scrollPosition.current = scroller.current.scrollTop;
      setStart(Math.max(0, Math.floor(scroller.current.scrollTop / rowHeight) - 3));
    }
    previousHeight.current = rowHeight;
  }, [rowHeight]);
  if (result.sheets) {
    const sheet = result.sheets[selected];
    if (!sheet) return <div className="preview-message">工作簿没有可显示的工作表。</div>;
    const columns = Math.max(sheet.columns, 1);
    const end = Math.min(sheet.rows.length, start + 50);
    return (
      <div className="workbook-preview">
        <TextAppearanceControls />
        <PreviewToolbar className="content-toolbar">
          <span>
            <Table2 size={14} />
            {sheet.rows.length} 行 · {sheet.columns} 列{sheet.truncated ? ' · 已截断' : ''}
          </span>
          <span className="toolbar-summary">{result.note ?? '只读 · 显示已保存的公式结果'}</span>
        </PreviewToolbar>
        <div
          className="workbook-scroll"
          ref={scroller}
          style={
            {
              '--workbook-row-height': `${rowHeight}px`,
              overflowAnchor: 'none',
            } as React.CSSProperties
          }
          onScroll={(e) => {
            scrollPosition.current = e.currentTarget.scrollTop;
            setStart(Math.max(0, Math.floor(scrollPosition.current / rowHeight) - 3));
          }}
        >
          <table className="workbook-table">
            <thead>
              <tr>
                <th />
                <>
                  {Array.from({ length: columns }, (_, col) => (
                    <th key={col}>{columnName(col)}</th>
                  ))}
                </>
              </tr>
            </thead>
            <tbody>
              {start > 0 && (
                <tr aria-hidden="true">
                  <td
                    colSpan={columns + 1}
                    style={{ height: start * rowHeight, padding: 0, border: 0 }}
                  />
                </tr>
              )}
              {sheet.rows.slice(start, end).map((row, offset) => (
                <tr key={start + offset}>
                  <th>{start + offset + 1}</th>
                  {Array.from({ length: columns }, (_, col) => (
                    <td
                      key={col}
                      title={row[col] ?? ''}
                      data-search-row={start + offset}
                      data-search-column={col}
                    >
                      {row[col] ?? ''}
                    </td>
                  ))}
                </tr>
              ))}
              {end < sheet.rows.length && (
                <tr aria-hidden="true">
                  <td
                    colSpan={columns + 1}
                    style={{ height: (sheet.rows.length - end) * rowHeight, padding: 0, border: 0 }}
                  />
                </tr>
              )}
            </tbody>
          </table>
          {!sheet.rows.length && <p className="empty-filter">此工作表为空。</p>}
        </div>
        <div className="sheet-tabs" role="tablist" aria-label="工作表">
          {result.sheets.map((s, i) => (
            <button
              key={i}
              role="tab"
              aria-selected={i === selected}
              className={i === selected ? 'selected' : ''}
              onClick={() => {
                setSelected(i);
                setStart(0);
                scrollPosition.current = 0;
                if (scroller.current) scroller.current.scrollTop = 0;
              }}
            >
              {s.name}
            </button>
          ))}
        </div>
      </div>
    );
  }
  const slide = result.slides?.[selected];
  if (!slide) return <div className="preview-message">演示文稿没有可显示的幻灯片。</div>;
  return (
    <div className="slides-preview">
      <TextAppearanceControls />
      <PreviewToolbar className="content-toolbar">
        <span>演示文稿文字速览</span>
        <span className="toolbar-summary">图片、动画与原始布局请用默认应用查看</span>
      </PreviewToolbar>
      <div className="slide-scroll">
        <article className="slide-paper">
          <div className="eyebrow">SLIDE {String(selected + 1).padStart(2, '0')}</div>
          <h1>{slide.title}</h1>
          {slide.paragraphs.map((paragraph, i) => (
            <p key={i}>{paragraph}</p>
          ))}
        </article>
      </div>
      <PreviewToolbar className="slide-controls">
        <button
          title="上一张幻灯片"
          disabled={selected === 0}
          onClick={() => setSelected((i) => i - 1)}
        >
          <ChevronLeft size={16} />
        </button>
        <span>
          {selected + 1} / {result.slides!.length}
        </span>
        <button
          title="下一张幻灯片"
          disabled={selected + 1 >= result.slides!.length}
          onClick={() => setSelected((i) => i + 1)}
        >
          <ChevronRight size={16} />
        </button>
      </PreviewToolbar>
    </div>
  );
}
