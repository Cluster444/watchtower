import { describe, expect, test } from "bun:test";
import {
  executeMutationPlan,
  planReadyToRunDemotion,
  planReadyToRunPromotion,
  planTriageMove,
  type IssueMutationGateway,
  type MutationStep,
} from "./triageActions";
import type { IssueCard } from "./issueBoard";
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

describe("planTriageMove", () => {
  test("resolves conflicted cards by removing all canonical labels before applying the destination", () => {
    const plan = planTriageMove({
      card: card(["needs-info", "ready-for-agent"]),
      destination: "ready-for-human",
      vocabulary,
    });

    expect(plan.steps).toEqual([
      { type: "removeLabel", issueNumber: 6, label: "needs-info" },
      { type: "removeLabel", issueNumber: 6, label: "ready-for-agent" },
      { type: "addLabel", issueNumber: 6, label: "ready-for-human" },
    ]);
  });

  test("moving to Inbox only removes canonical labels", () => {
    const plan = planTriageMove({
      card: card(["bug", "needs-triage", "ready-for-agent"]),
      destination: "inbox",
      vocabulary,
    });

    expect(plan.steps).toEqual([
      { type: "removeLabel", issueNumber: 6, label: "needs-triage" },
      { type: "removeLabel", issueNumber: 6, label: "ready-for-agent" },
    ]);
  });

  test("planning Close as wontfix requires confirmation, applies wontfix, and closes the issue", () => {
    const plan = planTriageMove({
      card: card(["needs-info"]),
      destination: "wontfix",
      vocabulary,
    });

    expect(plan).toEqual({
      description: "Close #6 as wontfix",
      requiresConfirmation: true,
      steps: [
        { type: "removeLabel", issueNumber: 6, label: "needs-info" },
        { type: "addLabel", issueNumber: 6, label: "wontfix" },
        { type: "closeIssue", issueNumber: 6 },
      ],
    });
  });
});

describe("ready-to-run action planning", () => {
  test("promotion applies Sandcastle without changing triage labels when ready for agent", () => {
    const plan = planReadyToRunPromotion({ card: card(["ready-for-agent"]), vocabulary });

    expect(plan).toEqual({
      description: "Mark #6 ready to run",
      requiresConfirmation: false,
      steps: [{ type: "addLabel", issueNumber: 6, label: "Sandcastle" }],
    });
  });

  test("promotion requires one confirmation when the issue is not ready for agent", () => {
    const plan = planReadyToRunPromotion({ card: card(["needs-info"]), vocabulary });

    expect(plan).toEqual({
      description: "Mark #6 ready to run outside ready-for-agent",
      requiresConfirmation: true,
      steps: [{ type: "addLabel", issueNumber: 6, label: "Sandcastle" }],
    });
  });

  test("promotion requires one confirmation when the issue is conflicted", () => {
    const plan = planReadyToRunPromotion({ card: card(["needs-info", "ready-for-agent"]), vocabulary });

    expect(plan).toEqual({
      description: "Mark conflicted #6 ready to run",
      requiresConfirmation: true,
      steps: [{ type: "addLabel", issueNumber: 6, label: "Sandcastle" }],
    });
  });

  test("promotion combines non-ready and conflicted confirmation into one prompt", () => {
    const plan = planReadyToRunPromotion({ card: card(["needs-info", "ready-for-human"]), vocabulary });

    expect(plan).toEqual({
      description: "Mark conflicted #6 ready to run outside ready-for-agent",
      requiresConfirmation: true,
      steps: [{ type: "addLabel", issueNumber: 6, label: "Sandcastle" }],
    });
  });

  test("demotion removes Sandcastle without changing triage labels", () => {
    const plan = planReadyToRunDemotion({ card: card(["Sandcastle", "ready-for-human"]) });

    expect(plan).toEqual({
      description: "Unmark #6 ready to run",
      requiresConfirmation: false,
      steps: [{ type: "removeLabel", issueNumber: 6, label: "Sandcastle" }],
    });
  });
});

describe("executeMutationPlan", () => {
  test("runs ordered steps, stops on failure, reports partial success risk, and refreshes", async () => {
    const calls: string[] = [];
    const gateway: IssueMutationGateway = {
      async addLabel(issueNumber, label) {
        calls.push(`add:${issueNumber}:${label}`);
        throw new Error("label add failed");
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

    const result = await executeMutationPlan(
      {
        description: "Move #6 to ready-for-agent",
        requiresConfirmation: false,
        steps: [
          { type: "removeLabel", issueNumber: 6, label: "needs-info" },
          { type: "addLabel", issueNumber: 6, label: "ready-for-agent" },
          { type: "closeIssue", issueNumber: 6 },
        ],
      },
      gateway,
    );

    expect(calls).toEqual(["remove:6:needs-info", "add:6:ready-for-agent", "refresh"]);
    expect(result).toEqual({
      ok: false,
      failedStep: { type: "addLabel", issueNumber: 6, label: "ready-for-agent" },
      message:
        "Failed to add label ready-for-agent to #6: label add failed. Earlier mutation steps may have succeeded. No automatic rollback was attempted. Refreshed from GitHub.",
    });
  });
});

function card(workflowLabels: string[]): IssueCard {
  return {
    bodyPreview: "preview",
    number: 6,
    title: "Move issue cards",
    updatedAge: "1h ago",
    updatedAt: "2026-05-22T12:00:00Z",
    workflowLabels,
  };
}
