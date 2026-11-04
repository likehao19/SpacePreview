export function markdownImageUrl(source: string): string | null {
  try {
    const url = new URL(source.startsWith('//') ? `https:${source}` : source);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}
