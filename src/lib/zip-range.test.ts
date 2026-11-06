import { expect, it } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { inflateZipEntry, parseZipDirectory, readZipDirectory, readZipEntry } from './zip-range';

it('reads a small entry from a large ZIP using only bounded ranges and verifies CRC', async () => {
  const bytes = zipSync(
    { '目录/你好.txt': strToU8('可读中文'), 'large.bin': new Uint8Array(40 * 1024 * 1024) },
    { level: 0 },
  );
  let readCount = 0;
  const read = async (offset: number, length: number) => {
    readCount += length;
    return bytes.slice(offset, offset + length);
  };
  const directory = await readZipDirectory(bytes.length, read);
  const entries = parseZipDirectory(directory.bytes, directory.count);
  expect(entries[0].name).toBe('目录/你好.txt');
  const compressed = await readZipEntry(entries[0], bytes.length, read);
  expect(new TextDecoder().decode(inflateZipEntry(compressed, entries[0]))).toBe('可读中文');
  expect(readCount).toBeLessThan(70000);
  expect(() => inflateZipEntry(compressed, { ...entries[0], crc: 1 })).toThrow('校验');
  await expect(readZipEntry(entries[1], bytes.length, read)).rejects.toThrow('32 MB');
  await expect(
    readZipEntry({ ...entries[0], encrypted: true }, bytes.length, read),
  ).rejects.toThrow('加密');
});

it('bounds deflate expansion and rejects malformed directories', async () => {
  const bytes = zipSync({ 'large.txt': strToU8('x'.repeat(9 * 1024 * 1024)) });
  const read = async (offset: number, length: number) => bytes.slice(offset, offset + length);
  const directory = await readZipDirectory(bytes.length, read);
  const entry = parseZipDirectory(directory.bytes, directory.count)[0];
  const compressed = await readZipEntry({ ...entry, size: 10 }, bytes.length, read);
  expect(inflateZipEntry(await readZipEntry(entry, bytes.length, read), entry).length).toBe(
    9 * 1024 * 1024,
  );
  expect(() => inflateZipEntry(compressed, { ...entry, size: 10 })).toThrow('内存上限');
  expect(() => parseZipDirectory(directory.bytes.slice(0, -1), 1)).toThrow();
});

it('lists and opens ZIP64 without loading its whole archive', async () => {
  const base = zipSync({ 'a.txt': strToU8('zip64') }, { level: 0 });
  const end = base.length - 22;
  const baseView = new DataView(base.buffer);
  const directorySize = baseView.getUint32(end + 12, true),
    directoryOffset = baseView.getUint32(end + 16, true);
  const result = new Uint8Array(base.length + 76);
  result.set(base.subarray(0, end));
  const view = new DataView(result.buffer);
  view.setUint32(end, 0x06064b50, true);
  view.setBigUint64(end + 4, 44n, true);
  view.setBigUint64(end + 24, 1n, true);
  view.setBigUint64(end + 32, 1n, true);
  view.setBigUint64(end + 40, BigInt(directorySize), true);
  view.setBigUint64(end + 48, BigInt(directoryOffset), true);
  view.setUint32(end + 56, 0x07064b50, true);
  view.setBigUint64(end + 64, BigInt(end), true);
  view.setUint32(end + 72, 1, true);
  result.set(base.subarray(end), end + 76);
  view.setUint16(end + 76 + 10, 65535, true);
  const read = async (offset: number, length: number) => result.slice(offset, offset + length);
  const directory = await readZipDirectory(result.length, read);
  const entry = parseZipDirectory(directory.bytes, directory.count)[0];
  expect(
    new TextDecoder().decode(
      inflateZipEntry(await readZipEntry(entry, result.length, read), entry),
    ),
  ).toBe('zip64');
  view.setUint32(end + 72, 2, true);
  await expect(readZipDirectory(result.length, read)).rejects.toThrow('分卷');
});
it('applies configured limits above 32 MiB with bounded reads and actual output checks', async () => {
  const size = 33 * 1024 * 1024;
  const bytes = zipSync({ 'large.bin': new Uint8Array(size) }, { level: 0 });
  const lengths: number[] = [];
  const read = async (offset: number, length: number) => {
    lengths.push(length);
    return bytes.slice(offset, offset + length);
  };
  const directory = await readZipDirectory(bytes.length, read);
  const entry = parseZipDirectory(directory.bytes, directory.count)[0];
  await expect(readZipEntry(entry, bytes.length, read, 16 * 1024 * 1024)).rejects.toThrow('16 MB');
  const compressed = await readZipEntry(entry, bytes.length, read, 64 * 1024 * 1024);
  expect(Math.max(...lengths)).toBeLessThanOrEqual(4 * 1024 * 1024);
  expect(inflateZipEntry(compressed, entry, 64 * 1024 * 1024).length).toBe(size);
  expect(() => inflateZipEntry(compressed, entry, 16 * 1024 * 1024)).toThrow('上限');
  const deflated = zipSync({ 'large.bin': new Uint8Array(size) });
  const range = async (offset: number, length: number) => deflated.slice(offset, offset + length);
  const index = await readZipDirectory(deflated.length, range);
  const item = parseZipDirectory(index.bytes, index.count)[0];
  const data = await readZipEntry(item, deflated.length, range, 64 * 1024 * 1024);
  expect(() => inflateZipEntry(data, { ...item, size: 1 }, 64 * 1024 * 1024)).toThrow('内存上限');
}, 30_000);
