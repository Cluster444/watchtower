import { formatPreflightFailureLines } from "../setup/preflightScreen";
import { Board } from "../components/kanban/Board";
import { issueBoardToKanbanColumns } from "../components/issues/issueKanban";
import type { BoardState } from "../issues/boardState";
import type { TriageMoveDestination } from "../issues/triageActions";
import type { WatchtowerShellState, WatchtowerScreen } from "./shell";
import type { SetupFailure } from "../setup/preflight";

const WATCHTOWER_SHELL_ID = "watchtower-shell";

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

export function WatchtowerShell({ state }: { state: WatchtowerShellState }) {
  if (!state.preflight.ok) {
    return <PreflightFailureView state={state} />;
  }

  return (
    <box
      borderStyle="rounded"
      flexDirection="column"
      gap={1}
      height="100%"
      id={WATCHTOWER_SHELL_ID}
      padding={1}
      width="100%"
    >
      <Header state={state} />
      <BoardArea state={state} />
      <CommandBar state={state} />
      <StatusBar state={state} />
    </box>
  );
}

function Header({ state }: { state: WatchtowerShellState }) {
  return (
    <box flexDirection="column" id="watchtower-header">
      <text fg="#8BD5CA">Watchtower</text>
      <text>Screen: {SCREEN_LABELS[state.screen]}</text>
    </box>
  );
}

function BoardArea({ state }: { state: WatchtowerShellState }) {
  const board = state.boardState?.visibleBoard ?? state.board;

  return (
    <box flexDirection="column" gap={0} id="watchtower-board">
      {board === undefined ? (
        <text>Issue board has not loaded yet.</text>
      ) : (
        <Board
          columns={issueBoardToKanbanColumns(board, state.screen)}
          cursor={state.boardState?.cursor ?? { columnIndex: 0, slotIndexByColumn: {} }}
        />
      )}
    </box>
  );
}

function CommandBar({ state }: { state: WatchtowerShellState }) {
  return (
    <box flexDirection="column" id="watchtower-command-bar">
      <text>{renderPrimaryCommandLine(state)}</text>
      {renderPromptLine(state)}
    </box>
  );
}

function StatusBar({ state }: { state: WatchtowerShellState }) {
  return (
    <box flexDirection="column" id="watchtower-status-bar">
      <text fg="#F9E2AF">{state.status}</text>
      <text fg="#A6ADC8">Selected: {renderSelectionSummary(state.boardState)}</text>
      <text fg={state.boardState?.searchFocused ? "#A6E3A1" : "#A6ADC8"}>
        Search: {state.boardState?.searchQuery ?? ""}
      </text>
    </box>
  );
}

function PreflightFailureView({ state }: { state: WatchtowerShellState }) {
  const failures: SetupFailure[] = state.preflight.ok ? [] : state.preflight.failures;
  const lines = formatPreflightFailureLines(failures);

  return (
    <box
      borderStyle="rounded"
      flexDirection="column"
      gap={1}
      height="100%"
      id={WATCHTOWER_SHELL_ID}
      padding={1}
      width="100%"
    >
      {lines.map((line, index) => (
        <text fg={getPreflightLineColor(index, lines.length)} key={`${index}:${line}`}>
          {line}
        </text>
      ))}
    </box>
  );
}

function renderPrimaryCommandLine(state: WatchtowerShellState): string {
  if (state.moveMenuOpen) {
    return "Move selected issue:";
  }

  if (state.pendingReadyToRunPromotion === true) {
    return "Mark ready to run requires confirmation.";
  }

  if (state.pendingDestructiveMove !== undefined) {
    return `${formatMoveMenuDestination(state.pendingDestructiveMove)} requires confirmation.`;
  }

  if (state.boardState === undefined) {
    return "1/t triage | 2/r run | / search | Ctrl+R refresh | q exit";
  }

  if (state.screen === "run") {
    return "j/k slot | h/l column | u unmark ready | o open | / search | Ctrl+R refresh | q exit";
  }

  return "j/k slot | h/l column | m move | p mark ready | o open | / search | Ctrl+R refresh | q exit";
}

function renderPromptLine(state: WatchtowerShellState) {
  if (state.moveMenuOpen) {
    return <text>{MOVE_MENU_OPTIONS}</text>;
  }

  if (state.pendingReadyToRunPromotion === true || state.pendingDestructiveMove !== undefined) {
    return <text>Enter confirm | Esc cancel</text>;
  }

  return undefined;
}

function formatMoveMenuDestination(destination: TriageMoveDestination): string {
  switch (destination) {
    case "wontfix":
      return "Close as wontfix";
    default:
      return destination;
  }
}

function renderSelectionSummary(boardState: BoardState | undefined): string {
  if (boardState === undefined) {
    return "none";
  }

  const selectedSlotIndex = boardState.cursor.slotIndexByColumn[boardState.cursor.columnIndex];
  if (selectedSlotIndex === undefined) {
    return `${boardState.selection.laneKey} empty`;
  }

  return `${boardState.selection.laneKey} card ${selectedSlotIndex + 1}`;
}

function getPreflightLineColor(index: number, lineCount: number): string | undefined {
  if (index === 0) {
    return "#F38BA8";
  }

  if (index === lineCount - 1) {
    return "#F9E2AF";
  }

  return undefined;
}
