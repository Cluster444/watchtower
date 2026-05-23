import type { IssueBoard, IssueCard, IssueLane } from "../../issues/issueBoard";
import type { LabelVocabulary } from "../../setup/labelVocabulary";
import {
  createBoardCursor,
  getSelectedSlotIndex,
  moveBoardCursor,
  normalizeBoardCursor,
  type BoardCursor,
} from "../kanban/cursor";
import {
  executeMutationPlan,
  planReadyToRunDemotion,
  planReadyToRunPromotion,
  planTriageMove,
  type IssueMutationGateway,
  type MutationPlan,
  type TriageMoveDestination,
} from "../../issues/triageActions";

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
  screen: BoardScreen;
  cursor: BoardCursor;
  selection: BoardSelection;
  repositoryUrl?: string;
  status: string;
};

export type BoardStateAction =
  | { type: "switchScreen"; screen: BoardScreen }
  | { type: "moveSelectionUp" }
  | { type: "moveSelectionDown" }
  | { type: "moveSelectionLeft" }
  | { type: "moveSelectionRight" };

export type BoardDataLoader = () => Promise<IssueBoard>;
export type MutationConfirmationOptions = { confirmed?: boolean };
export type TriageMoveOptions = MutationConfirmationOptions;
export type ReadyToRunOptions = MutationConfirmationOptions;

const TRIAGE_LANE_KEYS: readonly TriageLaneKey[] = [
  "inbox",
  "needs-triage",
  "needs-info",
  "ready-for-human",
  "ready-for-agent",
  "wontfix",
  "conflicted",
];

const RUN_LANE_KEYS: readonly RunLaneKey[] = ["readyToRun", "closed"];
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
    cursor: createBoardCursor(slotCountsForScreen(board, screen)),
    selection: { screen, laneKey: firstLaneKeyForScreen(screen), cardIndex: 0 },
    status: options.status ?? "GitHub issues loaded",
  };

  return normalizeBoardState(state);
}

export function reduceBoardState(state: BoardState, action: BoardStateAction): BoardState {
  switch (action.type) {
    case "switchScreen":
      return normalizeBoardState({
        ...state,
        screen: action.screen,
        cursor: createBoardCursor(slotCountsForScreen(state.board, action.screen)),
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
  }
}

export async function refreshBoardState(state: BoardState, loadBoard: BoardDataLoader): Promise<BoardState> {
  try {
    const board = await loadBoard();
    return normalizeBoardState({
      ...state,
      board,
      status: "GitHub issues loaded",
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
  return normalizeBoardState({
    ...state,
    board,
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
  const lane = getLane(state.board, state.screen, laneKeyForCursor(state));
  const slotIndex = getSelectedSlotIndex(state.cursor, slotCountsForScreen(state.board, state.screen));
  return slotIndex === undefined ? undefined : lane?.cards[slotIndex];
}

function moveSelection(state: BoardState, cardDelta: number, laneDelta: number): BoardState {
  const direction =
    laneDelta < 0 ? "left" : laneDelta > 0 ? "right" : cardDelta < 0 ? "up" : "down";

  return normalizeBoardState({
    ...state,
    cursor: moveBoardCursor(state.cursor, slotCountsForScreen(state.board, state.screen), direction),
    status: "Selection moved",
  });
}

export function normalizeBoardState(state: BoardState): BoardState {
  const laneKeys = laneKeysForScreen(state.screen);
  const cursor = normalizeBoardCursor(state.cursor, slotCountsForScreen(state.board, state.screen));
  const selectedLaneKey = laneKeys[cursor.columnIndex] ?? firstLaneKeyForScreen(state.screen);
  const selectedSlotIndex = cursor.slotIndexByColumn[cursor.columnIndex];

  return {
    ...state,
    cursor,
    selection: {
      screen: state.screen,
      laneKey: selectedLaneKey,
      cardIndex: selectedSlotIndex ?? 0,
    },
  };
}

function laneKeyForCursor(state: BoardState): BoardLaneKey {
  return laneKeysForScreen(state.screen)[state.cursor.columnIndex] ?? firstLaneKeyForScreen(state.screen);
}

function slotCountsForScreen(board: IssueBoard, screen: BoardScreen): number[] {
  return laneKeysForScreen(screen).map((laneKey) => getLane(board, screen, laneKey)?.cards.length ?? 0);
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
