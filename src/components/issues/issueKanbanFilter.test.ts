import { describe, expect, test } from "bun:test";
import { filterIssueKanban } from "./issueKanbanFilter";
import type { IssueBoard } from "../../issues/issueBoard";

describe("filterIssueKanban", () => {
  test("matches cards by number, title, workflow label, and body preview", () => {
    const source = board();
    const cursor = { columnIndex: 0, slotIndexByColumn: { 0: 0 } };

    expect(filterIssueKanban(source, "triage", cursor, "202").board.triage.inbox.cards.map((card) => card.number)).toEqual([202]);
    expect(filterIssueKanban(source, "triage", cursor, "oauth").board.triage["ready-for-agent"].cards.map((card) => card.number)).toEqual([303]);
    expect(filterIssueKanban(source, "run", cursor, "Sandcastle").board.run.readyToRun.cards.map((card) => card.number)).toEqual([404]);
    expect(filterIssueKanban(source, "triage", cursor, "token").board.triage["ready-for-agent"].cards.map((card) => card.number)).toEqual([303]);
  });

  test("keeps all columns visible and distinguishes search-hidden lanes from genuinely empty lanes", () => {
    const result = filterIssueKanban(board(), "triage", { columnIndex: 0, slotIndexByColumn: { 0: 0 } }, "missing");

    expect(Object.keys(result.board.triage)).toEqual([
      "inbox",
      "needs-triage",
      "needs-info",
      "ready-for-agent",
      "ready-for-human",
      "wontfix",
      "conflicted",
    ]);
    expect(result.board.triage.inbox.emptyState).toBe("No issues match the current search filter.");
    expect(result.board.triage["needs-info"].emptyState).toBe("No needs info issues.");
  });

  test("normalizes cursor slots across every column after filtering", () => {
    const result = filterIssueKanban(
      board(),
      "triage",
      { columnIndex: 4, slotIndexByColumn: { 0: 1, 1: 0, 2: 0, 3: 0, 4: 4, 5: 0, 6: 0 } },
      "oauth",
    );

    expect(result.cursor).toEqual({
      columnIndex: 4,
      slotIndexByColumn: {
        0: undefined,
        1: undefined,
        2: undefined,
        3: undefined,
        4: 0,
        5: undefined,
        6: undefined,
      },
    });
  });
});

function board(): IssueBoard {
  return {
    triage: {
      inbox: lane("Inbox", [
        card(101, "Inbox issue", [], "plain preview"),
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
