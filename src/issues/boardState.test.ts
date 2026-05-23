import { describe, expect, test } from "bun:test";
import {
  createBoardState,
  getSelectedIssueUrl,
  markSelectedIssueReadyToRun,
  moveSelectedIssueToTriageDestination,
  reduceBoardState,
  refreshBoardState,
  unmarkSelectedIssueReadyToRun,
  type BoardDataLoader,
} from "./boardState";
import type { IssueBoard } from "./issueBoard";
import type { IssueMutationGateway } from "./triageActions";
import type { LabelVocabulary } from "../setup/labelVocabulary";

describe("boardState", () => {
  test("moves selection through cards and lanes on the active screen", () => {
    let state = createBoardState(board());

    state = reduceBoardState(state, { type: "moveSelectionDown" });
    expect(state.selection).toEqual({ screen: "triage", laneKey: "inbox", cardIndex: 1 });

    state = reduceBoardState(state, { type: "moveSelectionRight" });
    expect(state.selection).toEqual({ screen: "triage", laneKey: "needs-triage", cardIndex: 0 });
    expect(state.cursor.slotIndexByColumn[state.cursor.columnIndex]).toBeUndefined();

    state = reduceBoardState(state, { type: "moveSelectionRight" });
    state = reduceBoardState(state, { type: "moveSelectionRight" });
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
    state = reduceBoardState(state, { type: "moveSelectionRight" });
    state = reduceBoardState(state, { type: "moveSelectionRight" });
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

  test("requires confirmation before Close as wontfix runs any mutation", async () => {
    const calls: string[] = [];
    const gateway = fakeMutationGateway(calls);

    const result = await moveSelectedIssueToTriageDestination(
      createBoardState(board()),
      "wontfix",
      vocabulary,
      gateway,
      async () => board({ firstInboxTitle: "Should not refresh" }),
    );

    expect(calls).toEqual([]);
    expect(result.status).toBe("Close #101 as wontfix requires confirmation.");
  });

  test("confirmed Close as wontfix applies the label, closes the issue, and refreshes", async () => {
    const calls: string[] = [];
    const gateway = fakeMutationGateway(calls);

    const result = await moveSelectedIssueToTriageDestination(
      createBoardState(board()),
      "wontfix",
      vocabulary,
      gateway,
      async () => board({ firstInboxTitle: "Closed issue removed" }),
      { confirmed: true },
    );

    expect(calls).toEqual(["add:101:wontfix", "close:101", "refresh"]);
    expect(result.status).toBe("Close #101 as wontfix complete. Refreshed from GitHub.");
    expect(result.board.triage.inbox.cards[0]?.title).toBe("Closed issue removed");
  });

  test("confirmed Close as wontfix stops on close failure and reports partial success risk", async () => {
    const calls: string[] = [];
    const gateway = fakeMutationGateway(calls, { failCloseIssue: true });

    const result = await moveSelectedIssueToTriageDestination(
      createBoardState(board()),
      "wontfix",
      vocabulary,
      gateway,
      async () => board({ firstInboxTitle: "Refreshed after close failure" }),
      { confirmed: true },
    );

    expect(calls).toEqual(["add:101:wontfix", "close:101", "refresh"]);
    expect(result.status).toContain("Failed to close #101");
    expect(result.status).toContain("Earlier mutation steps may have succeeded");
    expect(result.board.triage.inbox.cards[0]?.title).toBe("Refreshed after close failure");
  });

  test("marks a ready-for-agent triage issue ready to run and refreshes", async () => {
    const calls: string[] = [];
    const gateway = fakeMutationGateway(calls);
    const state = reduceBoardState(createBoardState(board()), { type: "moveSelectionRight" });
    const readyForAgentState = [
      { type: "moveSelectionRight" as const },
      { type: "moveSelectionRight" as const },
      { type: "moveSelectionRight" as const },
    ].reduce(reduceBoardState, state);

    const result = await markSelectedIssueReadyToRun(
      readyForAgentState,
      vocabulary,
      gateway,
      async () => board({ readyToRunTitle: "Promoted from GitHub" }),
    );

    expect(calls).toEqual(["add:303:Sandcastle", "refresh"]);
    expect(result.status).toBe("Mark #303 ready to run complete. Refreshed from GitHub.");
    expect(result.board.run.readyToRun.cards[0]?.title).toBe("Promoted from GitHub");
  });

  test("requires confirmation before promoting a non-ready triage issue", async () => {
    const calls: string[] = [];
    const gateway = fakeMutationGateway(calls);

    const result = await markSelectedIssueReadyToRun(
      createBoardState(board()),
      vocabulary,
      gateway,
      async () => board({ readyToRunTitle: "Should not refresh" }),
    );

    expect(calls).toEqual([]);
    expect(result.status).toBe("Mark #101 ready to run outside ready-for-agent requires confirmation.");
  });

  test("requires one combined confirmation before promoting a conflicted non-ready issue", async () => {
    const calls: string[] = [];
    const gateway = fakeMutationGateway(calls);
    let state = createBoardState(board());
    for (let index = 0; index < 6; index += 1) {
      state = reduceBoardState(state, { type: "moveSelectionRight" });
    }

    const result = await markSelectedIssueReadyToRun(
      state,
      vocabulary,
      gateway,
      async () => board({ readyToRunTitle: "Should not refresh" }),
    );

    expect(calls).toEqual([]);
    expect(result.status).toBe("Mark conflicted #505 ready to run outside ready-for-agent requires confirmation.");
  });

  test("confirmed promotion applies Sandcastle and refreshes", async () => {
    const calls: string[] = [];
    const gateway = fakeMutationGateway(calls);

    const result = await markSelectedIssueReadyToRun(
      createBoardState(board()),
      vocabulary,
      gateway,
      async () => board({ readyToRunTitle: "Confirmed promotion" }),
      { confirmed: true },
    );

    expect(calls).toEqual(["add:101:Sandcastle", "refresh"]);
    expect(result.status).toBe("Mark #101 ready to run outside ready-for-agent complete. Refreshed from GitHub.");
    expect(result.board.run.readyToRun.cards[0]?.title).toBe("Confirmed promotion");
  });

  test("unmarks an open ready-to-run issue and refreshes", async () => {
    const calls: string[] = [];
    const gateway = fakeMutationGateway(calls);
    const state = createBoardState(board(), { screen: "run" });

    const result = await unmarkSelectedIssueReadyToRun(
      state,
      gateway,
      async () => board({ firstInboxTitle: "Demoted from GitHub" }),
    );

    expect(calls).toEqual(["remove:404:Sandcastle", "refresh"]);
    expect(result.status).toBe("Unmark #404 ready to run complete. Refreshed from GitHub.");
    expect(result.board.triage.inbox.cards[0]?.title).toBe("Demoted from GitHub");
  });

  test("rejects demotion for closed run-screen issues", async () => {
    const calls: string[] = [];
    const gateway = fakeMutationGateway(calls);
    let state = createBoardState(board(), { screen: "run" });
    state = reduceBoardState(state, { type: "moveSelectionRight" });

    const result = await unmarkSelectedIssueReadyToRun(
      state,
      gateway,
      async () => board({ firstInboxTitle: "Should not refresh" }),
    );

    expect(calls).toEqual([]);
    expect(result.status).toBe("Closed run-screen issues cannot be unmarked in phase one.");
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

function board(options: { firstInboxTitle?: string; readyToRunTitle?: string } = {}): IssueBoard {
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
      conflicted: lane("Conflicted", [card(505, "Conflicted issue", ["needs-info", "ready-for-human"], "ambiguous")]),
    },
    run: {
      readyToRun: lane("Ready to run", [card(404, options.readyToRunTitle ?? "Run it", ["Sandcastle"], "ready")]),
      closed: lane("Closed", [card(606, "Closed run", ["Sandcastle"], "done")]),
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
  options: { failAddLabel?: boolean; failCloseIssue?: boolean } = {},
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
      if (options.failCloseIssue) {
        throw new Error("GitHub refused close");
      }
    },
    async refresh() {
      calls.push("refresh");
    },
    async removeLabel(issueNumber, label) {
      calls.push(`remove:${issueNumber}:${label}`);
    },
  };
}
