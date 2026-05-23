import { describe, expect, test } from "bun:test";
import { createBoardState, reduceBoardState } from "../components/issues/issueBoardState";
import type { IssueBoard } from "../issues/issueBoard";
import { createShellBarModel } from "./shellBars";
import type { WatchtowerShellState } from "./shell";

describe("createShellBarModel", () => {
  test("renders triage selected issue commands", () => {
    expect(commandLine(state({ boardState: createBoardState(board()) }))).toContain(
      "m move | p mark ready | o open",
    );
  });

  test("renders run open selected issue commands", () => {
    expect(commandLine(state({ boardState: createBoardState(board(), { screen: "run" }), screen: "run" }))).toContain(
      "u unmark ready | o open",
    );
  });

  test("renders run closed selected issue commands without unmark ready", () => {
    const boardState = reduceBoardState(createBoardState(board(), { screen: "run" }), {
      type: "moveSelectionRight",
    });

    const line = commandLine(state({ boardState, screen: "run" }));

    expect(line).toContain("o open");
    expect(line).not.toContain("u unmark ready");
  });

  test("renders empty focused columns without selected issue commands", () => {
    const boardState = reduceBoardState(createBoardState(board()), { type: "moveSelectionRight" });

    const line = commandLine(state({ boardState }));

    expect(line).toContain("h/l or arrows column");
    expect(line).not.toContain("m move");
    expect(line).not.toContain("p mark ready");
    expect(line).not.toContain("o open");
  });

  test("renders search, move menu, and confirmation contexts", () => {
    expect(commandLines(state({ searchFocused: true, searchQuery: "oauth" }))).toEqual([
      "Search: oauth | type to filter | Backspace clear | Esc cancel",
    ]);
    expect(commandLines(state({ moveMenuOpen: true }))).toEqual([
      "Move selected issue:",
      "0 Inbox | 1 needs-triage | 2 needs-info | 3 ready-for-agent | 4 ready-for-human | 5 Close as wontfix | Esc cancel",
    ]);
    expect(commandLines(state({ pendingDestructiveMove: "wontfix" }))).toEqual([
      "Close as wontfix requires confirmation.",
      "Enter confirm | Esc cancel",
    ]);
    expect(commandLines(state({ pendingReadyToRunPromotion: true }))).toEqual([
      "Mark ready to run requires confirmation.",
      "Enter confirm | Esc cancel",
    ]);
  });

  test("renders unloaded board commands without mutation commands", () => {
    const line = commandLine(state());

    expect(line).toBe("1/t triage | 2/r run | / search | Ctrl+R refresh | q exit");
    expect(line).not.toContain("m move");
    expect(line).not.toContain("p mark ready");
    expect(line).not.toContain("u unmark ready");
  });

  test("renders header navigation and status feedback", () => {
    const model = createShellBarModel(
      state({ boardState: createBoardState(board()), status: "Move #101 complete. Refreshed from GitHub." }),
    );

    expect(model.headerLines).toEqual(["Watchtower", "1/t Triage | 2/r Run", "Screen: Triage"]);
    expect(model.statusLines).toEqual([
      "Screen: Triage",
      "Selected: #101 Issue 101",
      "Status: Move #101 complete. Refreshed from GitHub.",
      "Search: ",
    ]);
  });
});

function commandLine(shellState: WatchtowerShellState): string {
  return commandLines(shellState).join("\n");
}

function commandLines(shellState: WatchtowerShellState): string[] {
  return createShellBarModel(shellState).commandLines;
}

function state(patch: Partial<WatchtowerShellState> = {}): WatchtowerShellState {
  return {
    moveMenuOpen: false,
    searchFocused: false,
    searchQuery: "",
    preflight: { ok: true },
    screen: "triage",
    status: "GitHub issues loaded",
    ...patch,
  };
}

function board(): IssueBoard {
  return {
    triage: {
      inbox: lane("Inbox", [card(101)]),
      "needs-triage": lane("Needs triage", []),
      "needs-info": lane("Needs info", []),
      "ready-for-human": lane("Ready for human", []),
      "ready-for-agent": lane("Ready for agent", []),
      wontfix: lane("Wontfix", []),
      conflicted: lane("Conflicted", []),
    },
    run: {
      readyToRun: lane("Ready to run", [card(202)]),
      closed: lane("Closed", [card(303)]),
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
