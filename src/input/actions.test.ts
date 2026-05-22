import { describe, expect, test } from "bun:test";
import { mapInputToAction } from "./actions";

describe("mapInputToAction", () => {
  test("maps multiple raw key events to the same semantic action", () => {
    expect(mapInputToAction({ type: "key", key: "1" })).toBe("switchToTriage");
    expect(mapInputToAction({ type: "key", key: "t" })).toBe("switchToTriage");
    expect(mapInputToAction({ type: "terminal", sequence: "\x1b[A" })).toBe("moveSelectionUp");
    expect(mapInputToAction({ type: "key", key: "k" })).toBe("moveSelectionUp");
  });

  test("maps required shell actions", () => {
    expect(mapInputToAction({ type: "key", key: "2" })).toBe("switchToRun");
    expect(mapInputToAction({ type: "key", key: "r" })).toBe("switchToRun");
    expect(mapInputToAction({ type: "key", key: "q" })).toBe("exit");
    expect(mapInputToAction({ type: "terminal", sequence: "\x03" })).toBe("exit");
    expect(mapInputToAction({ type: "key", key: "/" })).toBe("focusSearch");
    expect(mapInputToAction({ type: "terminal", sequence: "/" })).toBe("focusSearch");
    expect(mapInputToAction({ type: "key", key: "enter" })).toBe("confirmDestructiveAction");
    expect(mapInputToAction({ type: "terminal", sequence: "o" })).toBe("openSelectedIssue");
    expect(mapInputToAction({ type: "terminal", sequence: "\x7f" })).toBe("clearSearch");
  });

  test("leaves unmapped input and mouse events without an action", () => {
    expect(mapInputToAction({ type: "key", key: "z" })).toBeUndefined();
    expect(mapInputToAction({ type: "terminal", sequence: "\x1b[<0;1;1M" })).toBeUndefined();
    expect(mapInputToAction({ type: "mouse", sequence: "\x1b[<0;1;1M" })).toBeUndefined();
  });
});
