import { describe, expect, test } from "bun:test";
import { reduceShellSearchTextInput, reduceShellState, type WatchtowerShellState } from "./shell";
import { getActiveIssueActionBoardState, getActiveIssueBoardState } from "./activeIssueBoard";
import {
  createBoardState,
  getFocusedLaneKey,
  getSelectedCard,
  reduceBoardState,
} from "../components/issues/issueBoardState";
import type { IssueBoard } from "../issues/issueBoard";

describe("reduceShellState", () => {
  test("switches screens with status updates", () => {
    const state: WatchtowerShellState = {
      preflight: { ok: true },
      moveMenuOpen: false,
      searchFocused: false,
      searchQuery: "",
      screen: "triage",
      status: "CLI shell ready",
    };

    expect(reduceShellState(state, "switchToRun")).toEqual({
      preflight: { ok: true },
      moveMenuOpen: false,
      searchFocused: false,
      searchQuery: "",
      screen: "run",
      status: "Run screen selected",
    });
    expect(reduceShellState(state, "switchToTriage")).toEqual({
      preflight: { ok: true },
      moveMenuOpen: false,
      searchFocused: false,
      searchQuery: "",
      screen: "triage",
      status: "Triage screen selected",
    });
  });

  test("keeps the current screen for placeholder actions", () => {
    const state: WatchtowerShellState = {
      preflight: { ok: true },
      moveMenuOpen: false,
      searchFocused: false,
      searchQuery: "",
      screen: "run",
      status: "Run screen selected",
    };

    expect(reduceShellState(state, "refresh")).toEqual({
      preflight: { ok: true },
      moveMenuOpen: false,
      searchFocused: false,
      searchQuery: "",
      screen: "run",
      status: "Refresh requested",
    });
    expect(reduceShellState(state, "moveSelectionDown")).toEqual({
      preflight: { ok: true },
      moveMenuOpen: false,
      searchFocused: false,
      searchQuery: "",
      screen: "run",
      status: "Selection movement placeholder",
    });
  });

  test("leaves state unchanged for exit", () => {
    const state: WatchtowerShellState = {
      preflight: { ok: true },
      moveMenuOpen: false,
      searchFocused: false,
      searchQuery: "",
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
      searchFocused: false,
      searchQuery: "",
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
    const boardState = createBoardState(board());
    const state: WatchtowerShellState = {
      boardState,
      moveMenuOpen: false,
      searchFocused: false,
      searchQuery: "",
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
      searchFocused: false,
      searchQuery: "",
      status: "Canceled",
    });
  });

  test("does not open the move menu when an empty column is focused", () => {
    const boardState = reduceBoardState(createBoardState(board()), { type: "moveSelectionRight" });
    const state: WatchtowerShellState = {
      boardState,
      moveMenuOpen: false,
      searchFocused: false,
      searchQuery: "",
      preflight: { ok: true },
      screen: "triage",
      status: "Selection moved",
    };

    expect(reduceShellState(state, "openMoveMenu")).toEqual({
      ...state,
      status: "No issue is selected.",
    });
  });

  test("derives selected issue actions from the filtered cursor-selected card", () => {
    const boardState = createBoardState(board());
    const state: WatchtowerShellState = {
      boardState,
      moveMenuOpen: false,
      searchFocused: false,
      searchQuery: "202",
      preflight: { ok: true },
      screen: "triage",
      status: "Search: 202",
    };

    const active = getActiveIssueBoardState(state);

    expect(active?.screen).toBe("triage");
    expect(active === undefined ? undefined : getFocusedLaneKey(active)).toBe("inbox");
    expect(active?.cursor.slotIndexByColumn[active.cursor.columnIndex]).toBe(0);
    expect(active?.board.triage.inbox.cards.map((card) => card.number)).toEqual([202]);
  });

  test("maps filtered cursor-selected issue actions back to the canonical board", () => {
    const boardState = createBoardState(board());
    const state: WatchtowerShellState = {
      boardState,
      moveMenuOpen: false,
      searchFocused: false,
      searchQuery: "202",
      preflight: { ok: true },
      screen: "triage",
      status: "Search: 202",
    };

    const actionBoardState = getActiveIssueActionBoardState(state);

    expect(actionBoardState?.board.triage.inbox.cards.map((card) => card.number)).toEqual([101, 202]);
    expect(actionBoardState?.cursor.slotIndexByColumn[0]).toBe(1);
    expect(actionBoardState === undefined ? undefined : getSelectedCard(actionBoardState)?.number).toBe(202);
  });

  test("does not derive an issue action board when the filtered focused column is empty", () => {
    const boardState = createBoardState(board());
    const state: WatchtowerShellState = {
      boardState,
      moveMenuOpen: false,
      searchFocused: false,
      searchQuery: "missing",
      preflight: { ok: true },
      screen: "triage",
      status: "Search: missing",
    };

    expect(getActiveIssueActionBoardState(state)).toBeUndefined();
  });

  test("does not move the board cursor while search is focused", () => {
    const boardState = createBoardState(board());
    const state: WatchtowerShellState = {
      boardState,
      moveMenuOpen: false,
      searchFocused: true,
      searchQuery: "issue",
      preflight: { ok: true },
      screen: "triage",
      status: "Search: issue",
    };

    expect(reduceShellState(state, "moveSelectionDown")).toBe(state);
    expect(reduceShellState(state, "moveSelectionRight")).toBe(state);
  });

  test("does not move the board cursor while menus or confirmations are pending", () => {
    const boardState = createBoardState(board());
    const state: WatchtowerShellState = {
      boardState,
      moveMenuOpen: true,
      searchFocused: false,
      searchQuery: "",
      preflight: { ok: true },
      screen: "triage",
      status: "Move menu opened",
    };

    const pendingMoveState = { ...state, moveMenuOpen: false, pendingDestructiveMove: "wontfix" as const };
    const pendingReadyState = { ...state, moveMenuOpen: false, pendingReadyToRunPromotion: true };

    expect(reduceShellState(state, "moveSelectionDown")).toBe(state);
    expect(reduceShellState(pendingMoveState, "moveSelectionRight")).toBe(pendingMoveState);
    expect(reduceShellState(pendingReadyState, "moveSelectionDown")).toBe(pendingReadyState);
  });

  test("routes printable command keys into search text while search is focused", () => {
    const boardState = createBoardState(board());
    const state: WatchtowerShellState = {
      boardState,
      moveMenuOpen: false,
      searchFocused: true,
      searchQuery: "",
      preflight: { ok: true },
      screen: "triage",
      status: "Search focused",
    };

    const next = reduceShellSearchTextInput(state, "j");

    expect(next).toEqual({
      ...state,
      boardState: {
        ...boardState,
        cursor: {
          columnIndex: 0,
          slotIndexByColumn: {
            0: undefined,
            1: undefined,
            2: undefined,
            3: undefined,
            4: undefined,
            5: undefined,
            6: undefined,
          },
        },
      },
      searchQuery: "j",
      status: "Search: j",
    });
    expect(reduceShellSearchTextInput(state, "\x1b")).toBeUndefined();
    expect(reduceShellSearchTextInput(state, "\x7f")).toBeUndefined();
  });

  test("confirmation actions clear a pending Close as wontfix prompt", () => {
    const state: WatchtowerShellState = {
      boardState: {} as WatchtowerShellState["boardState"],
      moveMenuOpen: false,
      searchFocused: false,
      searchQuery: "",
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
      searchFocused: false,
      searchQuery: "",
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

function board(): IssueBoard {
  return {
    triage: {
      inbox: lane("Inbox", [card(101), card(202)]),
      "needs-triage": lane("Needs triage", []),
      "needs-info": lane("Needs info", []),
      "ready-for-human": lane("Ready for human", []),
      "ready-for-agent": lane("Ready for agent", []),
      wontfix: lane("Wontfix", []),
      conflicted: lane("Conflicted", []),
    },
    run: {
      readyToRun: lane("Ready to run", [card(202)]),
      closed: lane("Closed", []),
    },
  };
}

function lane(title: string, cards: IssueBoard["triage"]["inbox"]["cards"]) {
  return { title, cards, emptyState: `No ${title.toLowerCase()} issues.` };
}

function card(number: number) {
  return {
    bodyPreview: "plain preview",
    number,
    title: `Issue ${number}`,
    updatedAge: "1h ago",
    updatedAt: "2026-05-22T12:00:00Z",
    workflowLabels: [],
  };
}
