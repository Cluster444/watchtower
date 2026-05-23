import type { IssueBoard, IssueCard, IssueLane } from "../../issues/issueBoard";
import type { BoardLaneKey, BoardScreen } from "./issueBoardState";

export type IssueKanbanSlot = {
  key: string;
  card: IssueCard;
};

export type IssueKanbanColumnModel = {
  key: BoardLaneKey;
  title: string;
  emptyState: string;
  slots: IssueKanbanSlot[];
};

export function issueBoardToKanbanColumnModels(
  board: IssueBoard,
  screen: BoardScreen,
): IssueKanbanColumnModel[] {
  return lanesForScreen(board, screen).map(({ key, lane }) => ({
    emptyState: lane.emptyState,
    key,
    slots: lane.cards.map((card) => ({ card, key: String(card.number) })),
    title: lane.title,
  }));
}

function lanesForScreen(
  board: IssueBoard,
  screen: BoardScreen,
): Array<{ key: BoardLaneKey; lane: IssueLane }> {
  return screen === "triage"
    ? [
        { key: "inbox", lane: board.triage.inbox },
        { key: "needs-triage", lane: board.triage["needs-triage"] },
        { key: "needs-info", lane: board.triage["needs-info"] },
        { key: "ready-for-human", lane: board.triage["ready-for-human"] },
        { key: "ready-for-agent", lane: board.triage["ready-for-agent"] },
        { key: "wontfix", lane: board.triage.wontfix },
        { key: "conflicted", lane: board.triage.conflicted },
      ]
    : [
        { key: "readyToRun", lane: board.run.readyToRun },
        { key: "closed", lane: board.run.closed },
      ];
}
