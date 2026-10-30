// Canonical Windows paths retain their extended prefix for file access. Only
// convert ordinary drive/UNC paths at the clipboard boundary.
export function clipboardPath(path: string): string {
  if (/^\\\\\?\\UNC\\/i.test(path)) return `\\\\${path.slice(8)}`;
  if (/^\\\\\?\\[a-z]:\\/i.test(path)) return path.slice(4);
  return path;
}
