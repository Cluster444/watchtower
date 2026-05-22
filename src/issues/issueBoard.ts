import {
  CANONICAL_TRIAGE_ROLES,
  type CanonicalTriageRole,
  type LabelVocabulary,
} from "../setup/labelVocabulary";

export const SANDCASTLE_LABEL = "Sandcastle";

export type GitHubIssueState = "OPEN" | "CLOSED";

export type GitHubIssue = {
  number: number;
  title: string;
  body: string;
  labels: string[];
  state: GitHubIssueState;
  updatedAt: string;
};

export type IssueSets = {
  triageIssues: GitHubIssue[];
  readyToRunIssues: GitHubIssue[];
  closedRunIssues: GitHubIssue[];
};

export type IssueCard = {
  number: number;
  title: string;
  workflowLabels: string[];
  bodyPreview: string;
  updatedAge: string;
  updatedAt: string;
};

export type IssueLane = {
  title: string;
  emptyState: string;
  cards: IssueCard[];
};

export type IssueBoard = {
  triage: Record<TriageLaneKey, IssueLane>;
  run: {
    readyToRun: IssueLane;
    closed: IssueLane;
  };
};

type TriageLaneKey = CanonicalTriageRole | "inbox" | "conflicted";

const TRIAGE_LANE_TITLES: Record<TriageLaneKey, string> = {
  inbox: "Inbox",
  "needs-triage": "Needs triage",
  "needs-info": "Needs info",
  "ready-for-agent": "Ready for agent",
  "ready-for-human": "Ready for human",
  wontfix: "Wontfix",
  conflicted: "Conflicted",
};

const PREVIEW_MAX_LENGTH = 140;

export function classifyIssueBoard(
  issueSets: IssueSets,
  vocabulary: LabelVocabulary,
  now = new Date(),
): IssueBoard {
  const board = createEmptyIssueBoard();
  const workflowLabelLookup = createWorkflowLabelLookup(vocabulary);
  const toCard = (issue: GitHubIssue) => toIssueCard(issue, workflowLabelLookup, now);

  for (const issue of issueSets.triageIssues) {
    addTriageIssue(board, issue, vocabulary, workflowLabelLookup, now);
  }

  board.run.readyToRun.cards = issueSets.readyToRunIssues.map(toCard);
  board.run.closed.cards = issueSets.closedRunIssues.map(toCard);

  for (const lane of [...Object.values(board.triage), board.run.readyToRun, board.run.closed]) {
    lane.cards.sort(compareCardsByUpdatedAtDesc);
  }

  return board;
}

export function formatBodyPreview(
  body: string | null | undefined,
  options: { maxLength?: number } = {},
): string {
  const maxLength = options.maxLength ?? PREVIEW_MAX_LENGTH;
  const text = (body ?? "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/^[\s*-]+(\[[ x]\]\s*)?/gim, "")
    .replace(/[*_~]+/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}...`;
}

export function renderIssueBoardLines(board: IssueBoard, screen: "triage" | "run"): string[] {
  if (screen === "run") {
    return renderScreenLaneLines([board.run.readyToRun, board.run.closed]);
  }

  const triageLanes = getTriageLanes(board);
  if (areLanesEmpty(triageLanes)) {
    return ["Triage (0)", "No triage issues."];
  }

  return renderScreenLaneLines(triageLanes);
}

function getTriageLanes(board: IssueBoard): IssueLane[] {
  return [
    board.triage.inbox,
    ...CANONICAL_TRIAGE_ROLES.map((role) => board.triage[role]),
    board.triage.conflicted,
  ];
}

function areLanesEmpty(lanes: readonly IssueLane[]): boolean {
  return lanes.every((lane) => lane.cards.length === 0);
}

function createEmptyIssueBoard(): IssueBoard {
  return {
    triage: {
      inbox: createTriageLane("inbox", "No triage issues in Inbox."),
      "needs-triage": createTriageLane("needs-triage", "No issues need triage."),
      "needs-info": createTriageLane("needs-info", "No issues need info."),
      "ready-for-agent": createTriageLane("ready-for-agent", "No issues are ready for an agent."),
      "ready-for-human": createTriageLane("ready-for-human", "No issues are ready for a human."),
      wontfix: createTriageLane("wontfix", "No open issues are marked wontfix."),
      conflicted: createTriageLane("conflicted", "No conflicted issues."),
    },
    run: {
      readyToRun: createLane("Ready to run", "No ready-to-run issues."),
      closed: createLane("Closed", "No closed run issues."),
    },
  };
}

function createTriageLane(key: TriageLaneKey, emptyState: string): IssueLane {
  return {
    cards: [],
    emptyState,
    title: TRIAGE_LANE_TITLES[key],
  };
}

function createLane(title: string, emptyState: string): IssueLane {
  return {
    cards: [],
    emptyState,
    title,
  };
}

function addTriageIssue(
  board: IssueBoard,
  issue: GitHubIssue,
  vocabulary: LabelVocabulary,
  workflowLabelLookup: ReadonlySet<string>,
  now: Date,
): void {
  const roles = getIssueTriageRoles(issue, vocabulary);
  const card = toIssueCard(issue, workflowLabelLookup, now);
  const [role] = roles;

  if (role === undefined) {
    board.triage.inbox.cards.push(card);
    return;
  }

  if (roles.length > 1) {
    board.triage.conflicted.cards.push(card);
    return;
  }

  board.triage[role].cards.push(card);
}

function toIssueCard(issue: GitHubIssue, workflowLabelLookup: ReadonlySet<string>, now: Date): IssueCard {
  return {
    bodyPreview: formatBodyPreview(issue.body),
    number: issue.number,
    title: issue.title,
    updatedAge: formatUpdatedAge(new Date(issue.updatedAt), now),
    updatedAt: issue.updatedAt,
    workflowLabels: getWorkflowLabels(issue, workflowLabelLookup),
  };
}

function getIssueTriageRoles(issue: GitHubIssue, vocabulary: LabelVocabulary): CanonicalTriageRole[] {
  const issueLabels = createLabelLookup(issue.labels);
  return CANONICAL_TRIAGE_ROLES.filter((role) =>
    issueLabels.has(normalizeLabel(vocabulary.labelsByRole[role])),
  );
}

function getWorkflowLabels(issue: GitHubIssue, workflowLabelLookup: ReadonlySet<string>): string[] {
  return issue.labels.filter((label) => workflowLabelLookup.has(normalizeLabel(label)));
}

function createWorkflowLabelLookup(vocabulary: LabelVocabulary): Set<string> {
  return createLabelLookup([SANDCASTLE_LABEL, ...Object.values(vocabulary.labelsByRole)]);
}

function createLabelLookup(labels: string[]): Set<string> {
  return new Set(labels.map((label) => normalizeLabel(label)));
}

function normalizeLabel(label: string): string {
  return label.toLowerCase();
}

function compareCardsByUpdatedAtDesc(left: IssueCard, right: IssueCard): number {
  return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
}

function formatUpdatedAge(updatedAt: Date, now: Date): string {
  const elapsedMs = Math.max(0, now.getTime() - updatedAt.getTime());
  const minutes = Math.floor(elapsedMs / 60_000);
  if (minutes < 1) {
    return "just now";
  }
  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  if (days < 30) {
    return `${days}d ago`;
  }

  const months = Math.floor(days / 30);
  if (months < 12) {
    return `${months}mo ago`;
  }

  return `${Math.floor(months / 12)}y ago`;
}

function renderScreenLaneLines(lanes: readonly IssueLane[]): string[] {
  return lanes.flatMap((lane, index) =>
    index === lanes.length - 1 ? renderLaneLines(lane) : [...renderLaneLines(lane), ""],
  );
}

function renderLaneLines(lane: IssueLane): string[] {
  if (lane.cards.length === 0) {
    return [`${lane.title} (0)`, lane.emptyState];
  }

  return [
    `${lane.title} (${lane.cards.length})`,
    ...lane.cards.map((card) => renderIssueCardLine(card)),
  ];
}

function renderIssueCardLine(card: IssueCard): string {
  const labels = card.workflowLabels.length > 0 ? ` [${card.workflowLabels.join(", ")}]` : "";
  const preview = card.bodyPreview.length > 0 ? ` - ${card.bodyPreview}` : "";
  return `#${card.number}${labels} ${card.title} (${card.updatedAge})${preview}`;
}
