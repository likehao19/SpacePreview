import { usePreviewLoading } from './PreviewLoading';
import { useEffect, useState } from 'react';
import PreviewToolbar from './PreviewToolbar';
import type { PreviewFile } from '../lib/files';
import { readFullBytes } from '../lib/bridge';
import { fontCollection } from '../lib/font-collection';

export default function FontPreview({ file }: { file: PreviewFile }) {
  const [font, setFont] = useState('');
  const [name, setName] = useState(file.name);
  const [glyphs, setGlyphs] = useState<string[]>([]);
  const [sample, setSample] = useState('Innovation in China 中国智造，慧及全球 0123456789');
  const [version, setVersion] = useState('');
  const [outline, setOutline] = useState('');
  const [fallback, setFallback] = useState('');
  const [showGlyphs, setShowGlyphs] = useState(false);
  const [shown, setShown] = useState(256);
  const [error, setError] = useState('');
  usePreviewLoading(!font && !error, '正在解析字体');
  const [page, setPage] = useState(0);
  const [count, setCount] = useState(1);
  const specimenFamily = `${font}, "SimSun", "Songti SC", serif`;
  useEffect(() => {
    const controller = new AbortController();
    let face: FontFace | undefined;
    setFont('');
    setError('');
    setGlyphs([]);
    setName(file.name);
    setVersion('');
    setOutline('');
    setFallback('');
    setShowGlyphs(false);
    setShown(256);
    void readFullBytes(file, controller.signal)
      .then(async (source) => {
        const collection = fontCollection(source, page);
        const bytes = collection.bytes;
        setCount(collection.count);
        // Native IDs contain Windows paths. Never put path escapes into a CSS family name.
        const family = `preview-font-${crypto.randomUUID()}`;
        face = new FontFace(family, bytes.buffer as ArrayBuffer);
        await face.load();
        if (controller.signal.aborted) return;
        document.fonts.add(face);
        setFont(family);
        try {
          const { parse } = await import('opentype.js');
          const parsed = parse(bytes.buffer as ArrayBuffer);
          if (controller.signal.aborted) return;
          setName(parsed.names.fullName?.en ?? file.name);
          setVersion(parsed.names.version?.en ?? '');
          setOutline(
            parsed.outlinesFormat === 'truetype'
              ? 'OpenType · TrueType 轮廓'
              : parsed.outlinesFormat === 'cff'
                ? 'OpenType · CFF 轮廓'
                : parsed.outlinesFormat,
          );
          setFallback(
            !!parsed.tables.cmap?.glyphIndexMap?.['中'.codePointAt(0)!]
              ? '缺失的字符会使用系统回退字体。'
              : '此字体不包含中文字形，中文部分使用系统回退字体；英文和数字使用当前字体。',
          );
          // Read character coverage directly; do not decode every glyph's outline at startup.
          const mapping = parsed.tables.cmap?.glyphIndexMap ?? {};
          setGlyphs(
            Object.keys(mapping)
              .map(Number)
              .filter((code) => code >= 32 && code <= 0x10ffff && mapping[code] !== 0)
              .sort((a, b) => a - b)
              .map((code) => String.fromCodePoint(code)),
          );
        } catch {
          // WOFF2 is decoded by the system's font engine; it can still render samples.
          if (!controller.signal.aborted) {
            setFallback('无法读取字形覆盖信息，缺失的字符会使用系统回退字体。');
            setGlyphs(Array.from('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'));
          }
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => {
      controller.abort();
      if (face) document.fonts.delete(face);
    };
  }, [file, page]);
  return (
    <div className="font-preview">
      <PreviewToolbar className="content-toolbar">
        <span>{name}</span>
        {count > 1 && (
          <label className="preview-menu-option">
            <span>集合字体</span>
            <select
              aria-label="集合字体"
              value={page}
              onChange={(event) => setPage(Number(event.target.value))}
            >
              {Array.from({ length: count }, (_, i) => (
                <option key={i} value={i}>
                  第 {i + 1} 个字体
                </option>
              ))}
            </select>
          </label>
        )}
      </PreviewToolbar>
      {error ? (
        <p className="preview-message" role="alert">
          字体加载失败：{error}
        </p>
      ) : !font ? (
        <div className="preview-message" role="status">
          <span className="spinner" />
          正在加载字体…
        </div>
      ) : (
        <article className="font-paper">
          <h1>{name}</h1>
          <div className="font-metadata">
            {version && <p>版本：{version.replace(/^Version\s*/i, '')}</p>}
            {outline && <p>{outline}</p>}
            {fallback && <p className="font-fallback-note">{fallback}</p>}
          </div>
          <div className="font-character-lines" style={{ fontFamily: specimenFamily }}>
            <p>abcdefghijklmnopqrstuvwxyz ABCDEFGHIJKLMNOPQRSTUVWXYZ</p>
            <p>0123456789.:,; '" (!?) +-*/=</p>
          </div>
          <label className="font-sample-label">
            预览文字
            <input
              aria-label="字体预览文本"
              value={sample}
              onChange={(event) => setSample(event.target.value)}
            />
          </label>
          <div className="font-size-specimens" aria-label="多字号字体预览">
            {[12, 18, 24, 36, 48, 60, 72].map((size) => (
              <div className="font-size-row" key={size}>
                <span className="font-size-label">{size}</span>
                <span
                  className="font-size-text"
                  style={{ fontFamily: specimenFamily, fontSize: `${size}pt` }}
                >
                  {sample}
                </span>
              </div>
            ))}
          </div>
          <details
            className="font-glyph-details"
            open={showGlyphs}
            onToggle={(event) => setShowGlyphs(event.currentTarget.open)}
          >
            <summary>字形预览 · {glyphs.length.toLocaleString()} 个字符</summary>
            {showGlyphs && (
              <>
                <div className="font-glyphs" style={{ fontFamily: specimenFamily }}>
                  {glyphs.slice(0, shown).map((glyph) => (
                    <span
                      key={glyph}
                      title={`U+${glyph.codePointAt(0)!.toString(16).toUpperCase()}`}
                    >
                      {glyph}
                    </span>
                  ))}
                </div>
                {shown < glyphs.length && (
                  <button onClick={() => setShown((value) => value + 256)}>显示更多字形</button>
                )}
              </>
            )}
          </details>
        </article>
      )}
    </div>
  );
}
