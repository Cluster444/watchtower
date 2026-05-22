import { describe, expect, test } from "bun:test";
import { reduceShellState, type WatchtowerShellState } from "./shell";

describe("reduceShellState", () => {
  test("switches screens with status updates", () => {
    const state: WatchtowerShellState = {
      preflight: { ok: true },
      moveMenuOpen: false,
      screen: "triage",
      status: "CLI shell ready",
    };

    expect(reduceShellState(state, "switchToRun")).toEqual({
      preflight: { ok: true },
      moveMenuOpen: false,
      screen: "run",
      status: "Run screen selected",
    });
    expect(reduceShellState(state, "switchToTriage")).toEqual({
      preflight: { ok: true },
      moveMenuOpen: false,
      screen: "triage",
      status: "Triage screen selected",
    });
  });

  test("keeps the current screen for placeholder actions", () => {
    const state: WatchtowerShellState = {
      preflight: { ok: true },
      moveMenuOpen: false,
      screen: "run",
      status: "Run screen selected",
    };

    expect(reduceShellState(state, "refresh")).toEqual({
      preflight: { ok: true },
      moveMenuOpen: false,
      screen: "run",
      status: "Refresh requested",
    });
    expect(reduceShellState(state, "moveSelectionDown")).toEqual({
      preflight: { ok: true },
      moveMenuOpen: false,
      screen: "run",
      status: "Selection movement placeholder",
    });
  });

  test("leaves state unchanged for exit", () => {
    const state: WatchtowerShellState = {
      preflight: { ok: true },
      moveMenuOpen: false,
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
      moveMenuOpen: false,
      screen: "triage",
      status: "Setup blocked",
    };

    expect(reduceShellState(state, "switchToRun")).toBe(state);
    expect(reduceShellState(state, "refresh")).toEqual({
      ...state,
      status: "Refresh requested",
    });
  });

  test("opens and cancels the move menu when a board is loaded", () => {
    const state: WatchtowerShellState = {
      boardState: {} as WatchtowerShellState["boardState"],
      moveMenuOpen: false,
      preflight: { ok: true },
      screen: "triage",
      status: "GitHub issues loaded",
    };

    expect(reduceShellState(state, "openMoveMenu")).toEqual({
      ...state,
      moveMenuOpen: true,
      status: "Move menu opened",
    });
    expect(reduceShellState({ ...state, moveMenuOpen: true }, "cancel")).toEqual({
      ...state,
      moveMenuOpen: false,
      status: "Canceled",
    });
  });

  test("confirmation actions clear a pending Close as wontfix prompt", () => {
    const state: WatchtowerShellState = {
      boardState: {} as WatchtowerShellState["boardState"],
      moveMenuOpen: false,
      pendingDestructiveMove: "wontfix",
      preflight: { ok: true },
      screen: "triage",
      status: "Close #101 as wontfix requires confirmation.",
    };

    expect(reduceShellState(state, "cancel")).toEqual({
      ...state,
      pendingDestructiveMove: undefined,
      status: "Canceled",
    });
    expect(reduceShellState(state, "confirmDestructiveAction")).toEqual({
      ...state,
      pendingDestructiveMove: undefined,
      status: "Confirmed Close as wontfix",
    });
  });

  test("confirmation actions clear a pending ready-to-run promotion prompt", () => {
    const state: WatchtowerShellState = {
      boardState: {} as WatchtowerShellState["boardState"],
      moveMenuOpen: false,
      pendingReadyToRunPromotion: true,
      preflight: { ok: true },
      screen: "triage",
      status: "Mark #101 ready to run outside ready-for-agent requires confirmation.",
    };

    expect(reduceShellState(state, "cancel")).toEqual({
      ...state,
      pendingReadyToRunPromotion: undefined,
      status: "Canceled",
    });
    expect(reduceShellState(state, "confirmDestructiveAction")).toEqual({
      ...state,
      pendingReadyToRunPromotion: undefined,
      status: "Confirmed mark ready to run",
    });
  });
});
