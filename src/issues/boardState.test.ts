import { describe, expect, test } from "bun:test";
import {
  createBoardState,
  getSelectedIssueUrl,
  moveSelectedIssueToTriageDestination,
  reduceBoardState,
  refreshBoardState,
  type BoardDataLoader,
} from "./boardState";
import type { IssueBoard } from "./issueBoard";
import type { IssueMutationGateway } from "./triageActions";
import type { LabelVocabulary } from "../setup/labelVocabulary";

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

  test("moves the selected issue through triage labels and resolves to refreshed GitHub state", async () => {
    const calls: string[] = [];
    const gateway = fakeMutationGateway(calls);

    const state = await moveSelectedIssueToTriageDestination(
      createBoardState(board()),
      "ready-for-agent",
      vocabulary,
      gateway,
      async () => board({ firstInboxTitle: "Refreshed from GitHub" }),
    );

    expect(calls).toEqual(["add:101:ready-for-agent", "refresh"]);
    expect(state.status).toBe("Move #101 to ready-for-agent complete. Refreshed from GitHub.");
    expect(state.board.triage.inbox.cards[0]?.title).toBe("Refreshed from GitHub");
  });

  test("reports failed mutation steps and still resolves pending state with refresh", async () => {
    const calls: string[] = [];
    const gateway = fakeMutationGateway(calls, { failAddLabel: true });
    let state = createBoardState(board());
    state = reduceBoardState(state, { type: "moveSelectionRight" });

    const result = await moveSelectedIssueToTriageDestination(
      state,
      "needs-info",
      vocabulary,
      gateway,
      async () => board({ firstInboxTitle: "Refreshed after failure" }),
    );

    expect(calls).toEqual(["remove:303:ready-for-agent", "add:303:needs-info", "refresh"]);
    expect(result.status).toContain("Failed to add label needs-info to #303");
    expect(result.status).toContain("Earlier mutation steps may have succeeded");
    expect(result.board.triage.inbox.cards[0]?.title).toBe("Refreshed after failure");
  });
});

const vocabulary: LabelVocabulary = {
  labelsByRole: {
    "needs-triage": "needs-triage",
    "needs-info": "needs-info",
    "ready-for-agent": "ready-for-agent",
    "ready-for-human": "ready-for-human",
    wontfix: "wontfix",
  },
};

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

function fakeMutationGateway(
  calls: string[],
  options: { failAddLabel?: boolean } = {},
): IssueMutationGateway {
  return {
    async addLabel(issueNumber, label) {
      calls.push(`add:${issueNumber}:${label}`);
      if (options.failAddLabel) {
        throw new Error("GitHub refused label");
      }
    },
    async closeIssue(issueNumber) {
      calls.push(`close:${issueNumber}`);
    },
    async refresh() {
      calls.push("refresh");
    },
    async removeLabel(issueNumber, label) {
      calls.push(`remove:${issueNumber}:${label}`);
    },
  };
}
