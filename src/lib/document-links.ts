export type DocumentLink =
  | { kind: 'anchor'; anchor: string }
  | { kind: 'file'; path: string; anchor: string }
  | { kind: 'external'; url: string };

/** Decode URI components once; never let document links navigate the WebView. */
export function documentLink(reference: string): DocumentLink {
  const value = reference.trim();
  if (!value) return { kind: 'anchor', anchor: '' };
  if (/^(?:https?:|\/\/)/i.test(value)) {
    const url = new URL(value.startsWith('//') ? `https:${value}` : value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
      throw new Error('不支持此链接地址');
    return { kind: 'external', url: url.href };
  }
  // Custom protocols, file:// URLs and network paths must not launch applications.
  if (/^[a-z][a-z\d+.-]*:/i.test(value) || value.startsWith('\\\\'))
    throw new Error('此链接类型暂不支持，请使用相对文件路径或网页链接');
  const hash = value.indexOf('#');
  const anchor = decodeURIComponent(hash < 0 ? '' : value.slice(hash + 1));
  const path = decodeURIComponent(
    (hash < 0 ? value : value.slice(0, hash)).split('?')[0],
  ).replaceAll('\\', '/');
  if (path.includes('\0') || anchor.includes('\0') || path.includes(':') || path.startsWith('/'))
    throw new Error('不支持此文件链接');
  return path ? { kind: 'file', path, anchor } : { kind: 'anchor', anchor };
}

export function headingSlug(title: string) {
  return title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-');
}
