export const defaultReadingWidths = { reading: 860, text: 860, code: 1024 } as const;
export function clampReadingWidth(width: number) {
  return Math.max(320, Math.min(1600, Math.round(width)));
}
