import { describe, expect, test } from "bun:test";
import { issueBoardToKanbanColumns } from "./issueKanban";
import type { IssueBoard } from "../../issues/issueBoard";

describe("issueBoardToKanbanColumns", () => {
  test("adapts triage lanes to kanban columns in active board order", () => {
    const columns = issueBoardToKanbanColumns(board(), "triage");

    expect(columns.map((column) => column.title)).toEqual([
      "Inbox",
      "Needs triage",
      "Needs info",
      "Ready for human",
      "Ready for agent",
      "Wontfix",
      "Conflicted",
    ]);
    expect(columns.map((column) => column.slots.length)).toEqual([1, 0, 0, 1, 1, 0, 0]);
    expect(columns[1]?.emptyState).toBe("No needs triage issues.");
  });

  test("adapts run lanes without pulling in legacy row rendering", () => {
    const columns = issueBoardToKanbanColumns(board(), "run");

    expect(columns.map((column) => column.title)).toEqual(["Ready to run", "Closed"]);
    expect(columns.map((column) => column.slots.length)).toEqual([1, 1]);
  });
});

function board(): IssueBoard {
  return {
    triage: {
      inbox: lane("Inbox", [card(101)]),
      "needs-triage": lane("Needs triage", []),
      "needs-info": lane("Needs info", []),
      "ready-for-human": lane("Ready for human", [card(202)]),
      "ready-for-agent": lane("Ready for agent", [card(303)]),
      wontfix: lane("Wontfix", []),
      conflicted: lane("Conflicted", []),
    },
    run: {
      readyToRun: lane("Ready to run", [card(404)]),
      closed: lane("Closed", [card(505)]),
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
