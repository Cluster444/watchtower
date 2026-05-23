export type BoardCursor = {
  columnIndex: number;
  slotIndexByColumn: Record<number, number | undefined>;
};

export type BoardCursorDirection = "left" | "right" | "up" | "down";

export function createBoardCursor(slotCounts: readonly number[], columnIndex = 0): BoardCursor {
  return normalizeBoardCursor({ columnIndex, slotIndexByColumn: {} }, slotCounts);
}

export function moveBoardCursor(
  cursor: BoardCursor,
  slotCounts: readonly number[],
  direction: BoardCursorDirection,
): BoardCursor {
  const normalized = normalizeBoardCursor(cursor, slotCounts);

  if (direction === "left" || direction === "right") {
    return normalizeBoardCursor(
      {
        ...normalized,
        columnIndex: clamp(
          normalized.columnIndex + (direction === "left" ? -1 : 1),
          0,
          Math.max(0, slotCounts.length - 1),
        ),
      },
      slotCounts,
    );
  }

  const slotCount = slotCounts[normalized.columnIndex] ?? 0;
  if (slotCount === 0) {
    return normalized;
  }

  const currentSlotIndex = normalized.slotIndexByColumn[normalized.columnIndex] ?? 0;
  return normalizeBoardCursor(
    {
      ...normalized,
      slotIndexByColumn: {
        ...normalized.slotIndexByColumn,
        [normalized.columnIndex]: clamp(
          currentSlotIndex + (direction === "up" ? -1 : 1),
          0,
          slotCount - 1,
        ),
      },
    },
    slotCounts,
  );
}

export function normalizeBoardCursor(cursor: BoardCursor, slotCounts: readonly number[]): BoardCursor {
  const columnIndex = clamp(cursor.columnIndex, 0, Math.max(0, slotCounts.length - 1));
  const slotIndexByColumn: Record<number, number | undefined> = {};

  for (const [indexText, slotCount] of slotCounts.entries()) {
    slotIndexByColumn[indexText] =
      slotCount > 0 ? clamp(cursor.slotIndexByColumn[indexText] ?? 0, 0, slotCount - 1) : undefined;
  }

  return { columnIndex, slotIndexByColumn };
}

export function getSelectedSlotIndex(cursor: BoardCursor, slotCounts: readonly number[]): number | undefined {
  const normalized = normalizeBoardCursor(cursor, slotCounts);
  return normalized.slotIndexByColumn[normalized.columnIndex];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
