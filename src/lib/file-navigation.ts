const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
export function sortFilePaths(paths: string[]): string[] {
  return [...paths].sort(
    (a, b) =>
      collator.compare(a.split(/[\\/]/).at(-1)!, b.split(/[\\/]/).at(-1)!) || a.localeCompare(b),
  );
}
export function adjacentFile(
  paths: string[],
  current: string,
  direction: -1 | 1,
): string | undefined {
  const index = paths.indexOf(current);
  return index < 0 ? undefined : paths[index + direction];
}
