import {
  CANONICAL_TRIAGE_ROLES,
  type CanonicalTriageRole,
  type LabelVocabulary,
} from "../setup/labelVocabulary";
import { SANDCASTLE_LABEL, type IssueCard } from "./issueBoard";

export type TriageMoveDestination = CanonicalTriageRole | "inbox";

export type MutationStep =
  | { type: "removeLabel"; issueNumber: number; label: string }
  | { type: "addLabel"; issueNumber: number; label: string }
  | { type: "closeIssue"; issueNumber: number };

export type MutationPlan = {
  description: string;
  requiresConfirmation: boolean;
  steps: MutationStep[];
};

export type MutationExecutionResult =
  | { ok: true; message: string }
  | { ok: false; failedStep: MutationStep; message: string };

export type IssueMutationGateway = {
  addLabel(issueNumber: number, label: string): Promise<void>;
  removeLabel(issueNumber: number, label: string): Promise<void>;
  closeIssue(issueNumber: number): Promise<void>;
  refresh(): Promise<void>;
};

export function requiresTriageMoveConfirmation(destination: TriageMoveDestination): boolean {
  return destination === "wontfix";
}

export function planTriageMove(options: {
  card: IssueCard;
  destination: TriageMoveDestination;
  vocabulary: LabelVocabulary;
}): MutationPlan {
  const { card, destination, vocabulary } = options;
  const labelsToRemove = canonicalLabelsOnCard(card, vocabulary);
  const steps: MutationStep[] = labelsToRemove.map((label) => ({
    issueNumber: card.number,
    label,
    type: "removeLabel",
  }));

  if (destination !== "inbox") {
    steps.push({
      issueNumber: card.number,
      label: vocabulary.labelsByRole[destination],
      type: "addLabel",
    });
  }

  if (destination === "wontfix") {
    steps.push({
      issueNumber: card.number,
      type: "closeIssue",
    });
  }

  return {
    description: formatTriageMoveDescription(card.number, destination),
    requiresConfirmation: requiresTriageMoveConfirmation(destination),
    steps,
  };
}

export function planReadyToRunPromotion(options: {
  card: IssueCard;
  vocabulary: LabelVocabulary;
}): MutationPlan {
  const { card, vocabulary } = options;
  const triageLabels = canonicalLabelsOnCard(card, vocabulary);
  const hasReadyForAgentLabel = triageLabels.includes(vocabulary.labelsByRole["ready-for-agent"]);
  const hasConflictingTriageLabels = triageLabels.length > 1;

  return {
    description: formatReadyToRunPromotionDescription(card.number, {
      hasConflictingTriageLabels,
      hasReadyForAgentLabel,
    }),
    requiresConfirmation: !hasReadyForAgentLabel || hasConflictingTriageLabels,
    steps: [{ type: "addLabel", issueNumber: card.number, label: SANDCASTLE_LABEL }],
  };
}

export function planReadyToRunDemotion(options: { card: IssueCard }): MutationPlan {
  return {
    description: `Unmark #${options.card.number} ready to run`,
    requiresConfirmation: false,
    steps: [{ type: "removeLabel", issueNumber: options.card.number, label: SANDCASTLE_LABEL }],
  };
}

export async function executeMutationPlan(
  plan: MutationPlan,
  gateway: IssueMutationGateway,
): Promise<MutationExecutionResult> {
  for (const step of plan.steps) {
    try {
      await executeStep(step, gateway);
    } catch (error) {
      const refreshed = await refreshAfterMutation(gateway);
      return {
        failedStep: step,
        message: formatMutationFailureMessage(step, error, refreshed),
        ok: false,
      };
    }
  }

  const refreshed = await refreshAfterMutation(gateway);
  return {
    message: `${plan.description} complete.${formatRefreshResult(refreshed)}`,
    ok: true,
  };
}

function formatTriageMoveDescription(issueNumber: number, destination: TriageMoveDestination): string {
  switch (destination) {
    case "inbox":
      return `Move #${issueNumber} to Inbox`;
    case "wontfix":
      return `Close #${issueNumber} as wontfix`;
    default:
      return `Move #${issueNumber} to ${destination}`;
  }
}

function formatReadyToRunPromotionDescription(
  issueNumber: number,
  options: { hasConflictingTriageLabels: boolean; hasReadyForAgentLabel: boolean },
): string {
  const conflictPrefix = options.hasConflictingTriageLabels ? "conflicted " : "";
  const nonReadySuffix = options.hasReadyForAgentLabel ? "" : " outside ready-for-agent";
  return `Mark ${conflictPrefix}#${issueNumber} ready to run${nonReadySuffix}`;
}

function canonicalLabelsOnCard(card: IssueCard, vocabulary: LabelVocabulary): string[] {
  const cardLabels = new Set(card.workflowLabels.map(normalizeLabel));
  return CANONICAL_TRIAGE_ROLES.flatMap((role) => {
    const label = vocabulary.labelsByRole[role];
    return cardLabels.has(normalizeLabel(label)) ? [label] : [];
  });
}

async function executeStep(step: MutationStep, gateway: IssueMutationGateway): Promise<void> {
  switch (step.type) {
    case "addLabel":
      await gateway.addLabel(step.issueNumber, step.label);
      return;
    case "removeLabel":
      await gateway.removeLabel(step.issueNumber, step.label);
      return;
    case "closeIssue":
      await gateway.closeIssue(step.issueNumber);
      return;
  }
}

async function refreshAfterMutation(gateway: IssueMutationGateway): Promise<boolean> {
  try {
    await gateway.refresh();
    return true;
  } catch {
    return false;
  }
}

function formatStepFailure(step: MutationStep, error: unknown): string {
  return `Failed to ${formatStep(step)}: ${error instanceof Error ? error.message : String(error)}`;
}

function formatMutationFailureMessage(step: MutationStep, error: unknown, refreshed: boolean): string {
  return [
    formatStepFailure(step, error),
    ". Earlier mutation steps may have succeeded. No automatic rollback was attempted.",
    formatRefreshResult(refreshed),
  ].join("");
}

function formatRefreshResult(refreshed: boolean): string {
  return refreshed ? " Refreshed from GitHub." : " Refresh from GitHub failed.";
}

function formatStep(step: MutationStep): string {
  switch (step.type) {
    case "addLabel":
      return `add label ${step.label} to #${step.issueNumber}`;
    case "removeLabel":
      return `remove label ${step.label} from #${step.issueNumber}`;
    case "closeIssue":
      return `close #${step.issueNumber}`;
  }
}

function normalizeLabel(label: string): string {
  return label.toLowerCase();
}
