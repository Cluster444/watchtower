import { filterIssueKanban } from "../components/issues/issueKanbanFilter";
import {
  getSelectedCard,
  normalizeBoardState,
  type BoardLaneKey,
  type BoardScreen,
  type BoardState,
} from "../components/issues/issueBoardState";
import type { IssueBoard, IssueLane } from "../issues/issueBoard";
import type { WatchtowerShellState } from "./shell";

export function getActiveIssueBoardState(state: WatchtowerShellState): BoardState | undefined {
  if (state.boardState === undefined) {
    return undefined;
  }

  const filtered = filterIssueKanban(
    state.boardState.board,
    state.screen,
    state.boardState.cursor,
    state.searchQuery,
  );

  return normalizeBoardState({
    ...state.boardState,
    board: filtered.board,
    cursor: filtered.cursor,
    screen: state.screen,
  });
}

export function getActiveIssueActionBoardState(state: WatchtowerShellState): BoardState | undefined {
  if (state.boardState === undefined) {
    return undefined;
  }

  const activeBoardState = getActiveIssueBoardState(state);
  if (activeBoardState === undefined) {
    return undefined;
  }

  const selectedCard = getSelectedCard(activeBoardState);
  if (selectedCard === undefined) {
    return undefined;
  }

  const canonicalLane = getLane(state.boardState.board, activeBoardState.screen, activeBoardState.selection.laneKey);
  const canonicalCardIndex = canonicalLane?.cards.findIndex((card) => card.number === selectedCard.number) ?? -1;
  if (canonicalCardIndex < 0) {
    return undefined;
  }

  return normalizeBoardState({
    ...state.boardState,
    cursor: {
      ...state.boardState.cursor,
      columnIndex: activeBoardState.cursor.columnIndex,
      slotIndexByColumn: {
        ...state.boardState.cursor.slotIndexByColumn,
        [activeBoardState.cursor.columnIndex]: canonicalCardIndex,
      },
    },
    screen: activeBoardState.screen,
  });
}

function getLane(board: IssueBoard, screen: BoardScreen, laneKey: BoardLaneKey): IssueLane | undefined {
  if (screen === "run") {
    return laneKey === "readyToRun" || laneKey === "closed" ? board.run[laneKey] : undefined;
  }

  return laneKey === "readyToRun" || laneKey === "closed" ? undefined : board.triage[laneKey];
}
