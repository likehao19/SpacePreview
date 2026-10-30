import { expect, it } from 'vitest';
import { clipboardPath } from './clipboard-path';

it('copies canonical Windows drive paths without the internal prefix', () => {
  expect(
    clipboardPath(String.raw`\\?\D:\java-workspace\fanyadataboot\docs\architecture\README.md`),
  ).toBe(String.raw`D:\java-workspace\fanyadataboot\docs\architecture\README.md`);
  expect(clipboardPath(String.raw`\\?\c:\目录 有空格\文件.md`)).toBe(
    String.raw`c:\目录 有空格\文件.md`,
  );
});

it('preserves the leading double slash for network shares', () => {
  expect(clipboardPath(String.raw`\\?\UNC\server\share\file.txt`)).toBe(
    String.raw`\\server\share\file.txt`,
  );
  expect(clipboardPath(String.raw`\\?\unc\server\share\file.txt`)).toBe(
    String.raw`\\server\share\file.txt`,
  );
});

it('leaves ordinary paths and other device namespaces unchanged', () => {
  for (const path of [
    String.raw`D:\docs\README.md`,
    String.raw`\\server\share\file.txt`,
    '/Users/sttao/文件.md',
    '/home/user/file.txt',
    String.raw`\\?\Volume{123}\file.txt`,
    String.raw`\\.\PhysicalDrive0`,
  ]) {
    expect(clipboardPath(path)).toBe(path);
  }
});
