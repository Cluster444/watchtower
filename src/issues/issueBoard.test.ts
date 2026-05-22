import { describe, expect, test } from "bun:test";
import { classifyIssueBoard, formatBodyPreview, type GitHubIssue } from "./issueBoard";
import type { LabelVocabulary } from "../setup/labelVocabulary";

const vocabulary: LabelVocabulary = {
  labelsByRole: {
    "needs-triage": "needs-triage",
    "needs-info": "needs-info",
    "ready-for-agent": "ready-for-agent",
    "ready-for-human": "ready-for-human",
    wontfix: "wontfix",
  },
};

describe("formatBodyPreview", () => {
  test("turns markdown bodies into compact plain-text previews", () => {
    expect(
      formatBodyPreview(
        "# Heading\n\nBuild **this** [link](https://example.com).\n\n```ts\nconst hidden = true;\n```\n\n- first\n- second",
        { maxLength: 48 },
      ),
    ).toBe("Heading Build this link. first second");
  });
});

describe("classifyIssueBoard", () => {
  test("classifies triage and run lanes with workflow-only labels ordered by update time", () => {
    const board = classifyIssueBoard(
      {
        triageIssues: [
          issue({ number: 1, labels: ["bug"], updatedAt: "2026-05-20T10:00:00Z" }),
          issue({ number: 2, labels: ["ready-for-agent", "enhancement"], updatedAt: "2026-05-22T10:00:00Z" }),
          issue({ number: 3, labels: ["needs-info", "wontfix"], updatedAt: "2026-05-21T10:00:00Z" }),
        ],
        readyToRunIssues: [
          issue({ number: 4, labels: ["Sandcastle", "ready-for-agent"], updatedAt: "2026-05-22T11:00:00Z" }),
        ],
        closedRunIssues: [
          issue({
            number: 5,
            state: "CLOSED",
            labels: ["Sandcastle", "bug"],
            updatedAt: "2026-05-19T10:00:00Z",
          }),
        ],
      },
      vocabulary,
      new Date("2026-05-22T12:00:00Z"),
    );

    expect(board.triage.inbox.cards.map((card) => card.number)).toEqual([1]);
    expect(board.triage["ready-for-agent"].cards.map((card) => card.number)).toEqual([2]);
    expect(board.triage.conflicted.cards.map((card) => card.number)).toEqual([3]);
    expect(board.run.readyToRun.cards.map((card) => card.number)).toEqual([4]);
    expect(board.run.closed.cards.map((card) => card.number)).toEqual([5]);
    expect(board.run.readyToRun.cards[0]?.workflowLabels).toEqual(["Sandcastle", "ready-for-agent"]);
    expect(board.triage.inbox.cards[0]).not.toHaveProperty("assignees");
    expect(board.triage.inbox.cards[0]?.updatedAge).toBe("2d ago");
  });
});

function issue(overrides: Partial<GitHubIssue> & Pick<GitHubIssue, "number" | "labels" | "updatedAt">): GitHubIssue {
  return {
    body: "Body",
    labels: overrides.labels,
    number: overrides.number,
    state: overrides.state ?? "OPEN",
    title: `Issue ${overrides.number}`,
    updatedAt: overrides.updatedAt,
  };
}
