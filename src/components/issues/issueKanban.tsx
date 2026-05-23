import type { IssueBoard, IssueCard } from "../../issues/issueBoard";
import type { BoardScreen } from "../../issues/boardState";
import type { KanbanColumn } from "../kanban/Board";

export function issueBoardToKanbanColumns(board: IssueBoard, screen: BoardScreen): KanbanColumn[] {
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

  return lanes.map((lane) => ({
    emptyState: lane.emptyState,
    slots: lane.cards.map((card) => <IssueCardView card={card} />),
    title: lane.title,
  }));
}

export function IssueCardView({ card }: { card: IssueCard }) {
  const labels = card.workflowLabels.length > 0 ? `[${card.workflowLabels.join(", ")}]` : "";

  return (
    <box flexDirection="column">
      <text fg="#CDD6F4">
        #{card.number} {labels}
      </text>
      <text>{card.title}</text>
      <text fg="#A6ADC8">{card.bodyPreview}</text>
      <text fg="#6C7086">{card.updatedAge}</text>
    </box>
  );
}
