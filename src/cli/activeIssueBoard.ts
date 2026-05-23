import { filterIssueKanban } from "../components/issues/issueKanbanFilter";
import { normalizeBoardState, type BoardState } from "../issues/boardState";
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
