import type { ReactNode } from "react";
import type { BoardCursor } from "./cursor";

export type KanbanColumn = {
  title: string;
  emptyState: string;
  slots: ReactNode[];
};

export function Board({ columns, cursor }: { columns: readonly KanbanColumn[]; cursor: BoardCursor }) {
  return (
    <box flexDirection="row" gap={1} height="100%" id="kanban-board" width="100%">
      {columns.map((column, columnIndex) => (
        <Column
          column={column}
          focused={columnIndex === cursor.columnIndex}
          key={`${columnIndex}:${column.title}`}
          selectedSlotIndex={cursor.slotIndexByColumn[columnIndex]}
        />
      ))}
    </box>
  );
}

export function Column({
  column,
  focused,
  selectedSlotIndex,
}: {
  column: KanbanColumn;
  focused: boolean;
  selectedSlotIndex: number | undefined;
}) {
  return (
    <box
      backgroundColor={focused ? "#313244" : "#1E1E2E"}
      borderColor={focused ? "#89DCEB" : "#45475A"}
      borderStyle="single"
      flexDirection="column"
      flexGrow={1}
      gap={0}
      padding={1}
    >
      <text fg={focused ? "#CDD6F4" : "#A6ADC8"}>
        {column.title} ({column.slots.length})
      </text>
      {column.slots.length === 0 ? (
        <text fg="#6C7086">{column.emptyState}</text>
      ) : (
        column.slots.map((slot, slotIndex) => (
          <Slot focused={focused && selectedSlotIndex === slotIndex} key={slotIndex}>
            {slot}
          </Slot>
        ))
      )}
    </box>
  );
}

export function Slot({ children, focused }: { children: ReactNode; focused: boolean }) {
  return (
    <box backgroundColor={focused ? "#45475A" : undefined} borderStyle="single" flexDirection="column" padding={1}>
      {children}
    </box>
  );
}
