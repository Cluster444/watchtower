import { describe, expect, test } from "bun:test";
import { reduceShellState, type WatchtowerShellState } from "./shell";

describe("reduceShellState", () => {
  test("switches screens with status updates", () => {
    const state: WatchtowerShellState = {
      preflight: { ok: true },
      screen: "triage",
      status: "CLI shell ready",
    };

    expect(reduceShellState(state, "switchToRun")).toEqual({
      preflight: { ok: true },
      screen: "run",
      status: "Run screen selected",
    });
    expect(reduceShellState(state, "switchToTriage")).toEqual({
      preflight: { ok: true },
      screen: "triage",
      status: "Triage screen selected",
    });
  });

  test("keeps the current screen for placeholder actions", () => {
    const state: WatchtowerShellState = {
      preflight: { ok: true },
      screen: "run",
      status: "Run screen selected",
    };

    expect(reduceShellState(state, "refresh")).toEqual({
      preflight: { ok: true },
      screen: "run",
      status: "Refresh placeholder",
    });
    expect(reduceShellState(state, "moveSelectionDown")).toEqual({
      preflight: { ok: true },
      screen: "run",
      status: "Selection movement placeholder",
    });
  });

  test("leaves state unchanged for exit", () => {
    const state: WatchtowerShellState = {
      preflight: { ok: true },
      screen: "triage",
      status: "CLI shell ready",
    };

    expect(reduceShellState(state, "exit")).toBe(state);
  });

  test("blocks board actions while preflight has failures", () => {
    const state: WatchtowerShellState = {
      preflight: {
        ok: false,
        failures: [
          {
            code: "not-git-repo",
            title: "Current directory is not a git repo",
            detail: "Watchtower must run inside the target repo.",
            remediation: "Change into the target git repo, then restart Watchtower.",
          },
        ],
      },
      screen: "triage",
      status: "Setup blocked",
    };

    expect(reduceShellState(state, "switchToRun")).toBe(state);
    expect(reduceShellState(state, "refresh")).toEqual({
      ...state,
      status: "Refresh placeholder",
    });
  });
});
