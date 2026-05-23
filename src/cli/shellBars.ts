import { getFocusedLaneKey, getSelectedCard, type BoardState } from "../components/issues/issueBoardState";
import type { TriageMoveDestination } from "../issues/triageActions";
import type { WatchtowerShellState, WatchtowerScreen } from "./shell";
import { getActiveIssueBoardState } from "./activeIssueBoard";

export type ShellBarModel = {
  commandLines: string[];
  statusLines: string[];
  headerLines: string[];
};

const SCREEN_LABELS: Record<WatchtowerScreen, string> = {
  triage: "Triage",
  run: "Run",
};

const MOVE_MENU_OPTIONS = [
  "0 Inbox",
  "1 needs-triage",
  "2 needs-info",
  "3 ready-for-agent",
  "4 ready-for-human",
  "5 Close as wontfix",
  "Esc cancel",
].join(" | ");

export function createShellBarModel(state: WatchtowerShellState): ShellBarModel {
  const activeBoardState = getActiveIssueBoardState(state);
  return {
    commandLines: createCommandLines(state, activeBoardState),
    headerLines: ["Watchtower", "1/t Triage | 2/r Run", `Screen: ${SCREEN_LABELS[state.screen]}`],
    statusLines: [
      `Screen: ${SCREEN_LABELS[state.screen]}`,
      `Selected: ${renderSelectionSummary(activeBoardState)}`,
      `Status: ${state.status}`,
      `Search: ${state.searchQuery}`,
    ],
  };
}

function createCommandLines(state: WatchtowerShellState, activeBoardState: BoardState | undefined): string[] {
  if (state.moveMenuOpen) {
    return ["Move selected issue:", MOVE_MENU_OPTIONS];
  }

  if (state.pendingReadyToRunPromotion === true) {
    return ["Mark ready to run requires confirmation.", "Enter confirm | Esc cancel"];
  }

  if (state.pendingDestructiveMove !== undefined) {
    return [
      `${formatMoveMenuDestination(state.pendingDestructiveMove)} requires confirmation.`,
      "Enter confirm | Esc cancel",
    ];
  }

  if (state.searchFocused) {
    return [`Search: ${state.searchQuery} | type to filter | Backspace clear | Esc cancel`];
  }

  const persistentCommands = "1/t triage | 2/r run | / search | Ctrl+R refresh | q exit";
  if (activeBoardState === undefined) {
    return [persistentCommands];
  }

  if (!hasSelectedIssue(activeBoardState)) {
    return [`h/l or arrows column | ${persistentCommands}`];
  }

  const selectedIssueCommands = selectedIssueCommandsForContext(state, activeBoardState);
  return [`j/k or arrows slot | h/l or arrows column | ${selectedIssueCommands} | ${persistentCommands}`];
}

function selectedIssueCommandsForContext(state: WatchtowerShellState, activeBoardState: BoardState): string {
  if (state.screen === "run") {
    return getFocusedLaneKey(activeBoardState) === "closed" ? "o open" : "u unmark ready | o open";
  }

  return "m move | p mark ready | o open";
}

function renderSelectionSummary(boardState: BoardState | undefined): string {
  if (boardState === undefined) {
    return "no selected issue";
  }

  const card = getSelectedCard(boardState);
  if (card === undefined) {
    return `${getFocusedLaneKey(boardState)}: no selected issue`;
  }

  return `#${card.number} ${card.title}`;
}

function hasSelectedIssue(boardState: BoardState): boolean {
  return getSelectedCard(boardState) !== undefined;
}

function formatMoveMenuDestination(destination: TriageMoveDestination): string {
  switch (destination) {
    case "wontfix":
      return "Close as wontfix";
    default:
      return destination;
  }
}
