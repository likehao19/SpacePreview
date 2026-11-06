import type { WorkerRequest, WorkerResult } from './worker-types';

// One disposable worker per operation: cancellation and timeouts stop parsing, not just the UI.
export function parseInWorker(
  request: WorkerRequest,
  signal: AbortSignal,
  onPartial?: (result: WorkerResult) => void,
): Promise<WorkerResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../workers/preview.worker.ts', import.meta.url), {
      type: 'module',
    });
    const cleanup = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      worker.terminate();
    };
    const abort = () => {
      cleanup();
      reject(new DOMException('已取消', 'AbortError'));
    };
    const timeout =
      ['decoded-image', 'model', 'graphviz'].includes(request.kind) ||
      Math.max(request.bytes.byteLength, request.entry?.size ?? 0) > 512 * 1024
        ? 120_000
        : 10_000;
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`解析超过 ${timeout / 1000} 秒，已停止。可切换为文件信息预览。`));
    }, timeout);
    if (signal.aborted) {
      abort();
      return;
    }
    signal.addEventListener('abort', abort, { once: true });
    worker.onmessage = (event) => {
      if (event.data.type === 'partial-result') {
        onPartial?.(event.data.result);
        return;
      }
      cleanup();
      event.data.error ? reject(new Error(event.data.error)) : resolve(event.data);
    };
    worker.onerror = () => {
      cleanup();
      reject(new Error('解析失败，文件可能已损坏或格式不受支持。'));
    };
    worker.postMessage(request, [request.bytes.buffer as ArrayBuffer]);
  });
}
