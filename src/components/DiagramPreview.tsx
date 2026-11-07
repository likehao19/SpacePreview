import { usePreviewLoading } from './PreviewLoading';
import { useEffect, useState } from 'react';
import DOMPurify from 'dompurify';
import type { PreviewFile } from '../lib/files';
import { decodeText, extension } from '../lib/files';
import { readFullBytes } from '../lib/bridge';
import { parseInWorker } from '../lib/worker-client';
import DocumentReader from './DocumentReader';
import PreviewToolbar from './PreviewToolbar';

export default function DiagramPreview({ file }: { file: PreviewFile }) {
  const graphviz = ['dot', 'gv'].includes(extension(file.name));
  const label = graphviz ? 'Graphviz' : 'Mermaid';
  const [svg, setSvg] = useState('');
  const [markdown, setMarkdown] = useState<string>();
  const [zoom, setZoom] = useState(1);
  const [error, setError] = useState('');
  usePreviewLoading(!svg && markdown === undefined && !error, '正在绘制图表');
  useEffect(() => {
    const controller = new AbortController();
    void readFullBytes(file, controller.signal)
      .then(async (bytes) => {
        const source = decodeText(bytes).text;
        if (graphviz) {
          const result = await parseInWorker(
            { kind: 'graphviz', name: file.name, bytes },
            controller.signal,
          );
          if (!controller.signal.aborted)
            setSvg(
              DOMPurify.sanitize(result.html!, {
                USE_PROFILES: { svg: true, svgFilters: true },
                FORBID_TAGS: ['script', 'foreignObject', 'image', 'a'],
              }),
            );
          return;
        }
        if (
          extension(file.name) === 'mmd' &&
          !/^\s*(?:%%[^\n]*\n\s*)*(?:graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|journey|gantt|pie|mindmap|timeline|quadrantChart|xychart|sankey|block|packet|architecture|kanban|gitGraph)\b/m.test(
            source,
          )
        ) {
          const result = await parseInWorker(
            { kind: 'markdown', bytes, name: file.name },
            controller.signal,
          );
          if (!controller.signal.aborted) setMarkdown(result.html);
          return;
        }
        const { default: mermaid } = await import('mermaid');
        if (controller.signal.aborted) return;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          suppressErrorRendering: true,
          htmlLabels: false,
          maxTextSize: 200_000,
          maxEdges: 2500,
        });
        const diagram = await mermaid.render(
          `diagram-${crypto.randomUUID()}`,
          source.replace(/%%\{[\s\S]*?\}%%/g, ''),
        );
        if (!controller.signal.aborted)
          setSvg(
            DOMPurify.sanitize(diagram.svg, {
              USE_PROFILES: { svg: true, svgFilters: true },
              FORBID_TAGS: ['script', 'foreignObject', 'image', 'a'],
            }),
          );
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [file]);
  if (markdown !== undefined) return <DocumentReader html={markdown} />;
  return (
    <div className="diagram-preview">
      <PreviewToolbar className="content-toolbar">
        <span>{label} 图表</span>
        <button onClick={() => setZoom((value) => Math.max(0.2, value - 0.2))}>缩小</button>
        <button onClick={() => setZoom(1)}>适应图表</button>
        <button onClick={() => setZoom((value) => Math.min(5, value + 0.2))}>放大</button>
      </PreviewToolbar>
      {error ? (
        <div className="preview-message" role="alert">
          {error}
        </div>
      ) : !svg ? (
        <div className="preview-message" role="status">
          <span className="spinner" />
          正在绘制图表…
        </div>
      ) : (
        <div className="diagram-scroll">
          <div
            aria-label={`${label} 图表预览`}
            style={{ zoom }}
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        </div>
      )}
    </div>
  );
}
