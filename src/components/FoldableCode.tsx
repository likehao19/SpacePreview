import { useMemo } from 'react';
import { usePreviewState } from './PreviewSession';
import { codeFolds } from '../lib/code-folds';

export default function FoldableCode({
  html,
  text,
  language,
  query,
}: {
  html: string;
  text: string;
  language: string;
  query: string;
}) {
  const ranges = useMemo(() => codeFolds(text, language), [text, language]);
  const [collapsed, setCollapsed] = usePreviewState<Set<number>>('code.collapsed', () => new Set());
  let hiddenUntil = -1;
  const source = text.split('\n');
  return (
    <pre>
      {html.split('\n').map((line, i) => {
        if (i < hiddenUntil) return null;
        const end = ranges.get(i);
        const folded = !query && collapsed.has(i) && end !== undefined;
        if (folded) hiddenUntil = end;
        return (
          <div
            className={`code-line ${query && source[i]?.toLowerCase().includes(query.toLowerCase()) ? 'matched' : ''}`}
            key={i}
          >
            <span className="line-number">{i + 1}</span>
            {ranges.size > 0 && (
              <span className="fold-gutter">
                {end !== undefined && (
                  <button
                    aria-label={`${folded ? '展开' : '折叠'}第 ${i + 1} 行`}
                    aria-expanded={!folded}
                    onClick={() =>
                      setCollapsed((previous) => {
                        const next = new Set(previous);
                        if (next.has(i)) next.delete(i);
                        else next.add(i);
                        return next;
                      })
                    }
                  >
                    {folded ? '▸' : '▾'}
                  </button>
                )}
              </span>
            )}
            <code dangerouslySetInnerHTML={{ __html: line || ' ' }} />
            {folded && <span className="fold-summary"> … {end - i - 1} 行</span>}
          </div>
        );
      })}
    </pre>
  );
}
