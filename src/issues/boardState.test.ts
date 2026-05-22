import { describe, expect, test } from "bun:test";
import {
  createBoardState,
  getSelectedIssueUrl,
  reduceBoardState,
  refreshBoardState,
  type BoardDataLoader,
} from "./boardState";
import type { IssueBoard } from "./issueBoard";

describe("boardState", () => {
  test("filters loaded cards by number, title, workflow labels, and body preview", () => {
    const state = createBoardState(board());

    expect(reduceBoardState(state, { type: "setSearchQuery", query: "202" }).visibleBoard.triage.inbox.cards.map((card) => card.number)).toEqual([202]);
    expect(reduceBoardState(state, { type: "setSearchQuery", query: "oauth" }).visibleBoard.triage["ready-for-agent"].cards.map((card) => card.number)).toEqual([303]);
    expect(reduceBoardState(state, { type: "setSearchQuery", query: "Sandcastle" }).visibleBoard.run.readyToRun.cards.map((card) => card.number)).toEqual([404]);
    expect(reduceBoardState(state, { type: "setSearchQuery", query: "token" }).visibleBoard.triage["ready-for-agent"].cards.map((card) => card.number)).toEqual([303]);
  });

  test("distinguishes empty GitHub lanes from search-hidden lanes", () => {
    const state = reduceBoardState(createBoardState(board()), { type: "setSearchQuery", query: "missing" });

    expect(state.visibleBoard.triage.inbox.emptyState).toBe("No issues match the current search filter.");
    expect(state.visibleBoard.triage["needs-info"].emptyState).toBe("No needs info issues.");
  });

  test("moves selection through cards and lanes on the active screen", () => {
    let state = createBoardState(board());

    state = reduceBoardState(state, { type: "moveSelectionDown" });
    expect(state.selection).toEqual({ screen: "triage", laneKey: "inbox", cardIndex: 1 });

    state = reduceBoardState(state, { type: "moveSelectionRight" });
    expect(state.selection).toEqual({ screen: "triage", laneKey: "ready-for-agent", cardIndex: 0 });

    state = reduceBoardState(state, { type: "switchScreen", screen: "run" });
    expect(state.selection).toEqual({ screen: "run", laneKey: "readyToRun", cardIndex: 0 });
  });

  test("coordinates manual refresh with a fake loader", async () => {
    const calls: string[] = [];
    const loader: BoardDataLoader = async () => {
      calls.push("load");
      return board({ firstInboxTitle: "Fresh issue" });
    };

    const state = await refreshBoardState(createBoardState(board()), loader);

    expect(calls).toEqual(["load"]);
    expect(state.status).toBe("GitHub issues loaded");
    expect(state.board.triage.inbox.cards[0]?.title).toBe("Fresh issue");
  });

  test("returns the selected issue URL", () => {
    const state = createBoardState(board(), { repositoryUrl: "https://github.com/Cluster444/watchtower" });

    expect(getSelectedIssueUrl(state)).toBe("https://github.com/Cluster444/watchtower/issues/101");
  });
});

function board(options: { firstInboxTitle?: string } = {}): IssueBoard {
  return {
    triage: {
      inbox: lane("Inbox", [
        card(101, options.firstInboxTitle ?? "Inbox issue", [], "plain preview"),
        card(202, "Number lookup", [], "plain preview"),
      ]),
      "needs-triage": lane("Needs triage", []),
      "needs-info": lane("Needs info", []),
      "ready-for-agent": lane("Ready for agent", [card(303, "OAuth callback", ["ready-for-agent"], "token refresh fails")]),
      "ready-for-human": lane("Ready for human", []),
      wontfix: lane("Wontfix", []),
      conflicted: lane("Conflicted", []),
    },
    run: {
      readyToRun: lane("Ready to run", [card(404, "Run it", ["Sandcastle"], "ready")]),
      closed: lane("Closed", []),
    },
  };
}

function lane(title: string, cards: IssueBoard["triage"]["inbox"]["cards"]) {
  return { title, cards, emptyState: `No ${title.toLowerCase()} issues.` };
}

function card(number: number, title: string, workflowLabels: string[], bodyPreview: string) {
  return {
    bodyPreview,
    number,
    title,
    updatedAge: "1h ago",
    updatedAt: "2026-05-22T12:00:00Z",
    workflowLabels,
  };
}
