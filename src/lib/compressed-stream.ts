import { Gunzip } from 'fflate';
import { Decompress } from 'fzstd';
import { Buffer } from 'buffer';

export function decompressStream(bytes: Uint8Array, zstandard: boolean, limit = 256 * 1024 * 1024) {
  const chunks: Uint8Array[] = [];
  let size = 0;
  const output = (chunk: Uint8Array) => {
    size += chunk.length;
    if (size > limit) throw new Error('压缩流展开后超过设置上限。');
    chunks.push(chunk);
  };
  const decoder = zstandard ? new Decompress(output) : new Gunzip(output);
  for (let position = 0; position < bytes.length; position += 1024)
    decoder.push(bytes.subarray(position, position + 1024), position + 1024 >= bytes.length);
  if (!bytes.length) throw new Error('压缩流为空。');
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

export async function decompressArchiveStream(
  bytes: Uint8Array,
  format: string,
  limit = 256 * 1024 * 1024,
) {
  if (format !== 'bz2' && format !== 'xz')
    return decompressStream(bytes, ['zst', 'zstd'].includes(format), limit);
  const chunks: Uint8Array[] = [];
  let size = 0;
  const output = (chunk: Uint8Array) => {
    size += chunk.length;
    if (size > limit) throw new Error('压缩流展开后超过设置上限。');
    chunks.push(chunk);
  };
  if (format === 'xz') {
    const { XzReadableStream } = await import('xz-decompress');
    const reader = new XzReadableStream(
      new Blob([bytes as Uint8Array<ArrayBuffer>]).stream(),
    ).getReader();
    try {
      while (true) {
        const next = await reader.read();
        if (next.done) break;
        output(next.value);
      }
    } finally {
      await reader.cancel();
      reader.releaseLock();
    }
  } else {
    // seek-bzip uses the Node global even when given stream adapters. This
    // operation runs in a disposable preview worker, with the browser shim.
    const scope = globalThis as typeof globalThis & { Buffer?: typeof Buffer };
    scope.Buffer ??= Buffer;
    const { default: Bunzip } = await import('seek-bzip');
    let input = 0,
      position = 0,
      chunk = new Uint8Array(65536);
    Bunzip.decode(
      {
        readByte: () => (input < bytes.length ? bytes[input++] : -1),
        eof: () => input === bytes.length,
        read(target: Uint8Array, offset: number, length: number) {
          const count = Math.min(length, bytes.length - input);
          target.set(bytes.subarray(input, input + count), offset);
          input += count;
          return count || -1;
        },
      },
      {
        writeByte(value: number) {
          chunk[position++] = value;
          if (position === chunk.length) {
            output(chunk);
            chunk = new Uint8Array(65536);
            position = 0;
          }
        },
      },
      true,
    );
    if (position) output(chunk.slice(0, position));
  }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

export function isTar(bytes: Uint8Array) {
  if (bytes.length < 512 || !bytes[0]) return false;
  const checksum = new TextDecoder().decode(bytes.subarray(148, 156)).replace(/\0/g, '').trim();
  if (!/^[0-7]+$/.test(checksum)) return false;
  let sum = 0;
  for (let i = 0; i < 512; i++) sum += i >= 148 && i < 156 ? 32 : bytes[i];
  return sum === parseInt(checksum, 8);
}
