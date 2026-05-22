import { describe, expect, test } from "bun:test";
import { reduceShellState, type WatchtowerShellState } from "./shell";

describe("reduceShellState", () => {
  test("switches screens with status updates", () => {
    const state: WatchtowerShellState = {
      screen: "triage",
      status: "CLI shell ready",
    };

    expect(reduceShellState(state, "switchToRun")).toEqual({
      screen: "run",
      status: "Run screen selected",
    });
    expect(reduceShellState(state, "switchToTriage")).toEqual({
      screen: "triage",
      status: "Triage screen selected",
    });
  });

  test("keeps the current screen for placeholder actions", () => {
    const state: WatchtowerShellState = {
      screen: "run",
      status: "Run screen selected",
    };

    expect(reduceShellState(state, "refresh")).toEqual({
      screen: "run",
      status: "Refresh placeholder",
    });
    expect(reduceShellState(state, "moveSelectionDown")).toEqual({
      screen: "run",
      status: "Selection movement placeholder",
    });
  });

  test("leaves state unchanged for exit", () => {
    const state: WatchtowerShellState = {
      screen: "triage",
      status: "CLI shell ready",
    };

    expect(reduceShellState(state, "exit")).toBe(state);
  });
});
