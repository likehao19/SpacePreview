import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { parseInWorker } from './worker-client';
import type { WorkerRequest } from './worker-types';

class PreviewWorker {
  static latest: PreviewWorker;
  onmessage?: (event: { data: unknown }) => void;
  postMessage = vi.fn();
  terminate = vi.fn();
  constructor() {
    PreviewWorker.latest = this;
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('Worker', PreviewWorker);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function archiveRequest(size: number): WorkerRequest {
  return {
    kind: 'archive-data',
    name: 'compressed.zip',
    bytes: new Uint8Array(256 * 1024),
    entry: { name: 'large.bin', size, compressed: 256 * 1024, directory: false, index: 0 },
  };
}

it('allows large expanded ZIP entries to finish after the small-file deadline', async () => {
  const result = parseInWorker(archiveRequest(257 * 1024 * 1024), new AbortController().signal);
  await vi.advanceTimersByTimeAsync(10_001);
  expect(PreviewWorker.latest.terminate).not.toHaveBeenCalled();
  PreviewWorker.latest.onmessage?.({ data: { data: new Uint8Array([1]) } });
  await expect(result).resolves.toEqual({ data: new Uint8Array([1]) });
  expect(PreviewWorker.latest.terminate).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
});

it('keeps the small-file deadline bounded', async () => {
  const result = parseInWorker(archiveRequest(256 * 1024), new AbortController().signal);
  const rejection = expect(result).rejects.toThrow('解析超过 10 秒');
  await vi.advanceTimersByTimeAsync(10_000);
  await rejection;
  expect(PreviewWorker.latest.terminate).toHaveBeenCalledOnce();
});

it('still cancels and terminates a large-entry worker immediately', async () => {
  const controller = new AbortController();
  const result = parseInWorker(archiveRequest(257 * 1024 * 1024), controller.signal);
  const rejection = expect(result).rejects.toMatchObject({ name: 'AbortError' });
  controller.abort();
  await rejection;
  expect(PreviewWorker.latest.terminate).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
});
