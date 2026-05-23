import type { IssueBoard, IssueCard } from "../../issues/issueBoard";
import type { BoardScreen } from "./issueBoardState";
import type { KanbanColumn } from "../kanban/Board";
import { issueBoardToKanbanColumnModels } from "./issueKanbanModel";

export function issueBoardToKanbanColumns(board: IssueBoard, screen: BoardScreen): KanbanColumn[] {
  return issueBoardToKanbanColumnModels(board, screen).map((column) => ({
    emptyState: column.emptyState,
    key: column.key,
    slots: column.slots.map((slot) => ({
      content: <IssueCardView card={slot.card} />,
      key: slot.key,
    })),
    title: column.title,
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
