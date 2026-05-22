import type { IssueBoard, IssueCard, IssueLane } from "./issueBoard";
import type { LabelVocabulary } from "../setup/labelVocabulary";
import {
  executeMutationPlan,
  planReadyToRunDemotion,
  planReadyToRunPromotion,
  planTriageMove,
  type IssueMutationGateway,
  type MutationPlan,
  type TriageMoveDestination,
} from "./triageActions";

export type BoardScreen = "triage" | "run";
export type TriageLaneKey =
  | "inbox"
  | "needs-triage"
  | "needs-info"
  | "ready-for-agent"
  | "ready-for-human"
  | "wontfix"
  | "conflicted";
export type RunLaneKey = "readyToRun" | "closed";
export type BoardLaneKey = TriageLaneKey | RunLaneKey;

export type BoardSelection = {
  screen: BoardScreen;
  laneKey: BoardLaneKey;
  cardIndex: number;
};

export type BoardState = {
  board: IssueBoard;
  visibleBoard: IssueBoard;
  screen: BoardScreen;
  selection: BoardSelection;
  searchFocused: boolean;
  searchQuery: string;
  repositoryUrl?: string;
  status: string;
};

export type BoardStateAction =
  | { type: "switchScreen"; screen: BoardScreen }
  | { type: "moveSelectionUp" }
  | { type: "moveSelectionDown" }
  | { type: "moveSelectionLeft" }
  | { type: "moveSelectionRight" }
  | { type: "focusSearch" }
  | { type: "clearSearch" }
  | { type: "setSearchQuery"; query: string };

export type BoardDataLoader = () => Promise<IssueBoard>;
export type MutationConfirmationOptions = { confirmed?: boolean };
export type TriageMoveOptions = MutationConfirmationOptions;
export type ReadyToRunOptions = MutationConfirmationOptions;

const TRIAGE_LANE_KEYS: readonly TriageLaneKey[] = [
  "inbox",
  "needs-triage",
  "needs-info",
  "ready-for-agent",
  "ready-for-human",
  "wontfix",
  "conflicted",
];

const RUN_LANE_KEYS: readonly RunLaneKey[] = ["readyToRun", "closed"];
const SEARCH_EMPTY_STATE = "No issues match the current search filter.";
const SCREEN_STATUS_LABELS: Record<BoardScreen, string> = {
  triage: "Triage",
  run: "Run",
};

export function createBoardState(
  board: IssueBoard,
  options: { screen?: BoardScreen; repositoryUrl?: string; status?: string } = {},
): BoardState {
  const screen = options.screen ?? "triage";
  const state: BoardState = {
    board,
    repositoryUrl: options.repositoryUrl,
    screen,
    searchFocused: false,
    searchQuery: "",
    selection: { screen, laneKey: firstLaneKeyForScreen(screen), cardIndex: 0 },
    status: options.status ?? "GitHub issues loaded",
    visibleBoard: board,
  };

  return normalizeSelection(state);
}

export function reduceBoardState(state: BoardState, action: BoardStateAction): BoardState {
  switch (action.type) {
    case "switchScreen":
      return normalizeSelection({
        ...state,
        screen: action.screen,
        selection: { screen: action.screen, laneKey: firstLaneKeyForScreen(action.screen), cardIndex: 0 },
        status: `${SCREEN_STATUS_LABELS[action.screen]} screen selected`,
      });
    case "moveSelectionUp":
      return moveSelection(state, -1, 0);
    case "moveSelectionDown":
      return moveSelection(state, 1, 0);
    case "moveSelectionLeft":
      return moveSelection(state, 0, -1);
    case "moveSelectionRight":
      return moveSelection(state, 0, 1);
    case "focusSearch":
      return { ...state, searchFocused: true, status: "Search focused" };
    case "clearSearch":
      return normalizeSelection({
        ...state,
        searchFocused: false,
        searchQuery: "",
        status: "Search cleared",
        visibleBoard: filterIssueBoard(state.board, ""),
      });
    case "setSearchQuery":
      return normalizeSelection({
        ...state,
        searchFocused: true,
        searchQuery: action.query,
        status: action.query.trim().length > 0 ? `Search: ${action.query}` : "Search focused",
        visibleBoard: filterIssueBoard(state.board, action.query),
      });
  }
}

export async function refreshBoardState(state: BoardState, loadBoard: BoardDataLoader): Promise<BoardState> {
  try {
    const board = await loadBoard();
    return normalizeSelection({
      ...state,
      board,
      status: "GitHub issues loaded",
      visibleBoard: filterIssueBoard(board, state.searchQuery),
    });
  } catch (error) {
    return {
      ...state,
      status: `Failed to load GitHub issues: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export async function moveSelectedIssueToTriageDestination(
  state: BoardState,
  destination: TriageMoveDestination,
  vocabulary: LabelVocabulary,
  gateway: IssueMutationGateway,
  loadBoard: BoardDataLoader,
  options: TriageMoveOptions = {},
): Promise<BoardState> {
  const card = getSelectedCard(state);
  if (card === undefined || state.selection.screen !== "triage") {
    return { ...state, status: "No triage issue is selected." };
  }

  const plan = planTriageMove({ card, destination, vocabulary });
  return executeSelectedIssueMutation(state, plan, gateway, loadBoard, options);
}

export async function markSelectedIssueReadyToRun(
  state: BoardState,
  vocabulary: LabelVocabulary,
  gateway: IssueMutationGateway,
  loadBoard: BoardDataLoader,
  options: ReadyToRunOptions = {},
): Promise<BoardState> {
  const card = getSelectedCard(state);
  if (card === undefined || state.selection.screen !== "triage") {
    return { ...state, status: "No triage issue is selected." };
  }

  const plan = planReadyToRunPromotion({ card, vocabulary });
  return executeSelectedIssueMutation(state, plan, gateway, loadBoard, options);
}

export async function unmarkSelectedIssueReadyToRun(
  state: BoardState,
  gateway: IssueMutationGateway,
  loadBoard: BoardDataLoader,
): Promise<BoardState> {
  const card = getSelectedCard(state);
  if (card === undefined || state.selection.screen !== "run") {
    return { ...state, status: "No run issue is selected." };
  }

  if (state.selection.laneKey === "closed") {
    return { ...state, status: "Closed run-screen issues cannot be unmarked in phase one." };
  }

  const plan = planReadyToRunDemotion({ card });
  return executeSelectedIssueMutation(state, plan, gateway, loadBoard);
}

function applyRefreshedBoard(state: BoardState, board: IssueBoard): BoardState {
  return normalizeSelection({
    ...state,
    board,
    visibleBoard: filterIssueBoard(board, state.searchQuery),
  });
}

async function executeSelectedIssueMutation(
  state: BoardState,
  plan: MutationPlan,
  gateway: IssueMutationGateway,
  loadBoard: BoardDataLoader,
  options: MutationConfirmationOptions = {},
): Promise<BoardState> {
  if (plan.requiresConfirmation && options.confirmed !== true) {
    return { ...state, status: `${plan.description} requires confirmation.` };
  }

  let refreshedBoard: IssueBoard | undefined;
  const gatewayWithBoardRefresh: IssueMutationGateway = {
    ...gateway,
    async refresh() {
      await gateway.refresh();
      refreshedBoard = await loadBoard();
    },
  };

  const result = await executeMutationPlan(plan, gatewayWithBoardRefresh);
  const nextState = refreshedBoard === undefined ? state : applyRefreshedBoard(state, refreshedBoard);

  return {
    ...nextState,
    status: result.message,
  };
}

export function getSelectedIssueUrl(state: BoardState): string | undefined {
  if (state.repositoryUrl === undefined) {
    return undefined;
  }

  const card = getSelectedCard(state);
  return card === undefined ? undefined : `${state.repositoryUrl.replace(/\/$/, "")}/issues/${card.number}`;
}

export function getSelectedCard(state: BoardState): IssueCard | undefined {
  const lane = getLane(state.visibleBoard, state.selection.screen, state.selection.laneKey);
  return lane?.cards[state.selection.cardIndex];
}

export function filterIssueBoard(board: IssueBoard, query: string): IssueBoard {
  const normalizedQuery = query.trim().toLowerCase();
  if (normalizedQuery.length === 0) {
    return board;
  }

  return {
    triage: {
      inbox: filterLane(board.triage.inbox, normalizedQuery),
      "needs-triage": filterLane(board.triage["needs-triage"], normalizedQuery),
      "needs-info": filterLane(board.triage["needs-info"], normalizedQuery),
      "ready-for-agent": filterLane(board.triage["ready-for-agent"], normalizedQuery),
      "ready-for-human": filterLane(board.triage["ready-for-human"], normalizedQuery),
      wontfix: filterLane(board.triage.wontfix, normalizedQuery),
      conflicted: filterLane(board.triage.conflicted, normalizedQuery),
    },
    run: {
      readyToRun: filterLane(board.run.readyToRun, normalizedQuery),
      closed: filterLane(board.run.closed, normalizedQuery),
    },
  };
}

function filterLane(lane: IssueLane, normalizedQuery: string): IssueLane {
  const cards = lane.cards.filter((card) => cardMatchesQuery(card, normalizedQuery));
  return {
    ...lane,
    cards,
    emptyState: lane.cards.length > 0 && cards.length === 0 ? SEARCH_EMPTY_STATE : lane.emptyState,
  };
}

function cardMatchesQuery(card: IssueCard, normalizedQuery: string): boolean {
  return [
    String(card.number),
    card.title,
    card.bodyPreview,
    ...card.workflowLabels,
  ].some((value) => value.toLowerCase().includes(normalizedQuery));
}

function moveSelection(state: BoardState, cardDelta: number, laneDelta: number): BoardState {
  const laneKeys = laneKeysForScreen(state.screen);
  const currentLaneIndex = Math.max(0, laneKeys.indexOf(state.selection.laneKey));
  const laneIndex =
    laneDelta === 0
      ? currentLaneIndex
      : findNextSelectableLaneIndex(state, laneKeys, currentLaneIndex, laneDelta);
  const laneKey = laneKeys[laneIndex] ?? firstLaneKeyForScreen(state.screen);
  const lane = getLane(state.visibleBoard, state.screen, laneKey);
  const maxCardIndex = Math.max(0, (lane?.cards.length ?? 0) - 1);

  return {
    ...state,
    selection: {
      screen: state.screen,
      laneKey,
      cardIndex: clamp(laneDelta === 0 ? state.selection.cardIndex + cardDelta : 0, 0, maxCardIndex),
    },
    status: "Selection moved",
  };
}

function findNextSelectableLaneIndex(
  state: BoardState,
  laneKeys: readonly BoardLaneKey[],
  currentLaneIndex: number,
  laneDelta: number,
): number {
  let laneIndex = currentLaneIndex;
  do {
    laneIndex = clamp(laneIndex + laneDelta, 0, laneKeys.length - 1);
    const laneKey = laneKeys[laneIndex];
    const lane = laneKey === undefined ? undefined : getLane(state.visibleBoard, state.screen, laneKey);
    if ((lane?.cards.length ?? 0) > 0) {
      return laneIndex;
    }
  } while (laneIndex > 0 && laneIndex < laneKeys.length - 1);

  return laneIndex;
}

function normalizeSelection(state: BoardState): BoardState {
  const laneKeys = laneKeysForScreen(state.screen);
  const selectedLaneKey = laneKeys.includes(state.selection.laneKey)
    ? state.selection.laneKey
    : firstLaneKeyForScreen(state.screen);
  const lane = getLane(state.visibleBoard, state.screen, selectedLaneKey);
  const cardIndex = clamp(state.selection.cardIndex, 0, Math.max(0, (lane?.cards.length ?? 0) - 1));

  return {
    ...state,
    selection: {
      screen: state.screen,
      laneKey: selectedLaneKey,
      cardIndex,
    },
  };
}

function getLane(board: IssueBoard, screen: BoardScreen, laneKey: BoardLaneKey): IssueLane | undefined {
  if (screen === "run") {
    return isRunLaneKey(laneKey) ? board.run[laneKey] : undefined;
  }

  return isTriageLaneKey(laneKey) ? board.triage[laneKey] : undefined;
}

function firstLaneKeyForScreen(screen: BoardScreen): BoardLaneKey {
  return screen === "triage" ? "inbox" : "readyToRun";
}

function laneKeysForScreen(screen: BoardScreen): readonly BoardLaneKey[] {
  return screen === "triage" ? TRIAGE_LANE_KEYS : RUN_LANE_KEYS;
}

function isRunLaneKey(laneKey: BoardLaneKey): laneKey is RunLaneKey {
  return laneKey === "readyToRun" || laneKey === "closed";
}

function isTriageLaneKey(laneKey: BoardLaneKey): laneKey is TriageLaneKey {
  return !isRunLaneKey(laneKey);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
