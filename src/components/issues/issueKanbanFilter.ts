import { normalizeBoardCursor, type BoardCursor } from "../kanban/cursor";
import type { IssueBoard, IssueCard, IssueLane } from "../../issues/issueBoard";
import type { BoardScreen } from "./issueBoardState";

export type FilteredIssueKanban = {
  board: IssueBoard;
  cursor: BoardCursor;
};

const SEARCH_EMPTY_STATE = "No issues match the current search filter.";

export function filterIssueKanban(
  board: IssueBoard,
  screen: BoardScreen,
  cursor: BoardCursor,
  query: string,
): FilteredIssueKanban {
  const visibleBoard = filterIssueBoard(board, query);
  return {
    board: visibleBoard,
    cursor: normalizeBoardCursor(cursor, slotCountsForScreen(visibleBoard, screen)),
  };
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
  return [String(card.number), card.title, card.bodyPreview, ...card.workflowLabels].some((value) =>
    value.toLowerCase().includes(normalizedQuery),
  );
}

function slotCountsForScreen(board: IssueBoard, screen: BoardScreen): number[] {
  const lanes =
    screen === "triage"
      ? [
          board.triage.inbox,
          board.triage["needs-triage"],
          board.triage["needs-info"],
          board.triage["ready-for-human"],
          board.triage["ready-for-agent"],
          board.triage.wontfix,
          board.triage.conflicted,
        ]
      : [board.run.readyToRun, board.run.closed];

  return lanes.map((lane) => lane.cards.length);
}
