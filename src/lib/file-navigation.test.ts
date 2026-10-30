import { expect, it } from 'vitest';
import { adjacentFile, sortFilePaths } from './file-navigation';
it('sorts numbered filenames naturally across platforms without mutating input', () => {
  for (const parent of ['/tmp/', 'C:\\Screenshots\\']) {
    const paths = ['10.png', '2.png', '1.png'].map((name) => parent + name);
    expect(sortFilePaths(paths)).toEqual(['1.png', '2.png', '10.png'].map((name) => parent + name));
    expect(paths[0]).toBe(parent + '10.png');
  }
});
it('does not wrap at either end or navigate from an unknown file', () => {
  const paths = ['1.png', '2.png', '10.png'];
  expect(adjacentFile(paths, '1.png', 1)).toBe('2.png');
  expect(adjacentFile(paths, '2.png', -1)).toBe('1.png');
  expect(adjacentFile(paths, '1.png', -1)).toBeUndefined();
  expect(adjacentFile(paths, '10.png', 1)).toBeUndefined();
  expect(adjacentFile(paths, 'missing.png', 1)).toBeUndefined();
});
