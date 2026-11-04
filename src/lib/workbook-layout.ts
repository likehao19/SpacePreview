import type { WorkbookMerge, WorkbookSheet } from './worker-types';

export function workbookRowOffsets(
  sheet: WorkbookSheet | undefined,
  fallback: number,
  scale: number,
) {
  const offsets = [0];
  for (let row = 0; row < (sheet?.rows.length ?? 0); row++) {
    const height = sheet?.rowHeights?.[row] ?? sheet?.defaultRowHeight;
    offsets.push(offsets[row] + (height === undefined ? fallback : height * scale));
  }
  return offsets;
}

export function workbookRowAt(offsets: number[], top: number) {
  let low = 0,
    high = offsets.length - 1;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (offsets[middle] <= top) low = middle;
    else high = middle - 1;
  }
  return Math.min(low, Math.max(0, offsets.length - 2));
}

// Clip spanning cells to the rendered window so scrolling never mounts thousands of rows.
export function visibleWorkbookMerges(
  merges: WorkbookMerge[],
  start: number,
  end: number,
  offsets?: number[],
) {
  const anchors = new Map<string, WorkbookMerge>();
  const covered = new Set<string>();
  for (const merge of merges) {
    let first = Math.max(start, merge.row);
    const last = Math.min(end, merge.row + merge.rows);
    while (first < last && offsets && offsets[first] === offsets[first + 1]) first++;
    if (first >= last) continue;
    const keys: string[] = [];
    for (let row = first; row < last; row++)
      for (let col = merge.column; col < merge.column + merge.columns; col++)
        keys.push(`${row}:${col}`);
    // Invalid overlapping ranges must not create overlapping HTML table cells.
    if (keys.some((key) => covered.has(key))) continue;
    keys.forEach((key) => covered.add(key));
    anchors.set(`${first}:${merge.column}`, merge);
  }
  return { anchors, covered };
}
