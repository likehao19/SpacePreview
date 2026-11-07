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
  const [sample, setSample] = useState(
    '不必打开，看一眼就好。\nThe quick brown fox jumps over the lazy dog.\n0123456789 !@#$%&()',
  );
  const [size, setSize] = useState(32);
  const [error, setError] = useState('');
  usePreviewLoading(!font && !error, '正在解析字体');
  const [page, setPage] = useState(0);
  const [count, setCount] = useState(1);
  useEffect(() => {
    const controller = new AbortController();
    let face: FontFace | undefined;
    setFont('');
    setError('');
    setGlyphs([]);
    void readFullBytes(file, controller.signal)
      .then(async (source) => {
        const collection = fontCollection(source, page);
        const bytes = collection.bytes;
        setCount(collection.count);
        const family = `preview-${file.id}-${page}`;
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
          const unicode = new Set<number>();
          for (let i = 0; i < parsed.numGlyphs; i++)
            for (const code of parsed.glyphs.get(i).unicodes) if (code >= 32) unicode.add(code);
          setGlyphs([...unicode].sort((a, b) => a - b).map((code) => String.fromCodePoint(code)));
        } catch {
          // WOFF2 is decoded by the system's font engine; it can still render samples.
          if (!controller.signal.aborted)
            setGlyphs(Array.from('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'));
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
        <label className="preview-menu-option">
          <span>字号</span>
          <input
            aria-label="字体预览字号"
            type="range"
            min="14"
            max="96"
            value={size}
            onChange={(event) => setSize(Number(event.target.value))}
          />
        </label>
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
          <textarea
            aria-label="字体预览文本"
            value={sample}
            onChange={(event) => setSample(event.target.value)}
            style={{ fontFamily: `"${font}"`, fontSize: size }}
          />
          <h2>字形预览</h2>
          <div className="font-glyphs" style={{ fontFamily: `"${font}"` }}>
            {glyphs.map((glyph) => (
              <span key={glyph} title={`U+${glyph.codePointAt(0)!.toString(16).toUpperCase()}`}>
                {glyph}
              </span>
            ))}
          </div>
        </article>
      )}
    </div>
  );
}
