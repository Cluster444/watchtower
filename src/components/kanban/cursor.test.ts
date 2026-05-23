import { describe, expect, test } from "bun:test";
import {
  createBoardCursor,
  getSelectedSlotIndex,
  moveBoardCursor,
  normalizeBoardCursor,
  type BoardCursor,
} from "./cursor";

describe("BoardCursor helpers", () => {
  test("normalizes empty and non-empty columns", () => {
    expect(
      normalizeBoardCursor(
        { columnIndex: 8, slotIndexByColumn: { 0: 3, 1: 1, 2: -1 } },
        [0, 2, 1],
      ),
    ).toEqual({
      columnIndex: 2,
      slotIndexByColumn: { 0: undefined, 1: 1, 2: 0 },
    });
  });

  test("moves through empty columns while preserving per-column slot memory", () => {
    let cursor: BoardCursor = createBoardCursor([2, 0, 3]);

    cursor = moveBoardCursor(cursor, [2, 0, 3], "down");
    expect(cursor).toEqual({ columnIndex: 0, slotIndexByColumn: { 0: 1, 1: undefined, 2: 0 } });

    cursor = moveBoardCursor(cursor, [2, 0, 3], "right");
    expect(cursor).toEqual({ columnIndex: 1, slotIndexByColumn: { 0: 1, 1: undefined, 2: 0 } });
    expect(getSelectedSlotIndex(cursor, [2, 0, 3])).toBeUndefined();

    cursor = moveBoardCursor(cursor, [2, 0, 3], "right");
    cursor = moveBoardCursor(cursor, [2, 0, 3], "down");
    cursor = moveBoardCursor(cursor, [2, 0, 3], "left");
    cursor = moveBoardCursor(cursor, [2, 0, 3], "left");

    expect(cursor).toEqual({ columnIndex: 0, slotIndexByColumn: { 0: 1, 1: undefined, 2: 1 } });
  });

  test("clamps movement and resets cleanly for a new screen", () => {
    expect(moveBoardCursor(createBoardCursor([1]), [1], "left").columnIndex).toBe(0);
    expect(moveBoardCursor(createBoardCursor([1]), [1], "up").slotIndexByColumn[0]).toBe(0);
    expect(createBoardCursor([0, 4], 1)).toEqual({
      columnIndex: 1,
      slotIndexByColumn: { 0: undefined, 1: 0 },
    });
  });
});
