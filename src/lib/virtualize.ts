export const LIST_ROW_HEIGHT = 34
export const LIST_HEADER_HEIGHT = 28
export const BOARD_CARD_HEIGHT = 72
export const BOARD_COLUMN_WIDTH = 300

export function visibleRange(
  count: number,
  scrollTop: number,
  viewport: number,
  itemSize: number,
  overscan = 8,
): { start: number; end: number; offset: number; height: number } {
  const start = Math.max(0, Math.floor(scrollTop / itemSize) - overscan)
  const visible = Math.ceil(viewport / itemSize) + overscan * 2
  const end = Math.min(count, start + visible)
  return {
    start,
    end,
    offset: start * itemSize,
    height: count * itemSize,
  }
}
