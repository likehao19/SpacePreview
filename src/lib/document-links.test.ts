import { expect, it } from 'vitest';
import { documentLink, headingSlug } from './document-links';

it('resolves local anchors, Chinese/encoded file names, parent paths and cross-file fragments', () => {
  expect(documentLink('#%E7%AC%AC%E4%B8%80%E7%AB%A0')).toEqual({
    kind: 'anchor',
    anchor: '第一章',
  });
  expect(documentLink('../guide/%E5%BC%80%E5%A7%8B%20%E4%BD%BF%E7%94%A8.md?raw=1#安装')).toEqual({
    kind: 'file',
    path: '../guide/开始 使用.md',
    anchor: '安装',
  });
  expect(documentLink('.\\docs\\a.md#part-2')).toEqual({
    kind: 'file',
    path: './docs/a.md',
    anchor: 'part-2',
  });
  expect(documentLink('notes%23one.md#two')).toEqual({
    kind: 'file',
    path: 'notes#one.md',
    anchor: 'two',
  });
  expect(documentLink('')).toEqual({ kind: 'anchor', anchor: '' });
  expect(documentLink('#')).toEqual({ kind: 'anchor', anchor: '' });
});

it('opens HTTP(S) links externally and rejects unsupported schemes and absolute paths', () => {
  expect(documentLink('https://example.com/a?q=1#b')).toEqual({
    kind: 'external',
    url: 'https://example.com/a?q=1#b',
  });
  expect(documentLink('//example.com/a')).toEqual({
    kind: 'external',
    url: 'https://example.com/a',
  });
  for (const value of [
    'javascript:alert(1)',
    'data:text/html,x',
    'file:///etc/passwd',
    'mailto:a@example.com',
    'https://user:password@example.com',
    '\\\\host\\file',
    '%2f%2fhost/file',
    '/etc/passwd',
    'C:\\notes.md',
    'java%73cript%3Aalert(1)',
    'a%00.md',
    'bad%ZZ.md',
  ])
    expect(() => documentLink(value)).toThrow();
});

it('matches existing heading anchors for Chinese, punctuation, spaces and inline text', () => {
  expect(headingSlug('第 2 章：安装！')).toBe('第-2-章安装');
  expect(headingSlug('Hello, World!')).toBe('hello-world');
  expect(headingSlug('part_two - API')).toBe('part_two---api');
});
