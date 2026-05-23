import { formatPreflightFailureLines } from "../setup/preflightScreen";
import { Board } from "../components/kanban/Board";
import { issueBoardToKanbanColumns } from "../components/issues/issueKanban";
import { getActiveIssueBoardState } from "./activeIssueBoard";
import { createShellBarModel } from "./shellBars";
import type { WatchtowerShellState } from "./shell";
import type { SetupFailure } from "../setup/preflight";

const WATCHTOWER_SHELL_ID = "watchtower-shell";

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
  const model = createShellBarModel(state);

  return (
    <box flexDirection="column" id="watchtower-header">
      {model.headerLines.map((line, index) => (
        <text fg={index === 0 ? "#8BD5CA" : undefined} key={line}>
          {line}
        </text>
      ))}
    </box>
  );
}

function BoardArea({ state }: { state: WatchtowerShellState }) {
  const activeBoardState = getActiveIssueBoardState(state);
  const board = activeBoardState?.board ?? state.board;

  return (
    <box flexDirection="column" gap={0} id="watchtower-board">
      {board === undefined ? (
        <text>Issue board has not loaded yet.</text>
      ) : (
        <Board
          columns={issueBoardToKanbanColumns(board, state.screen)}
          cursor={activeBoardState?.cursor ?? state.boardState?.cursor ?? { columnIndex: 0, slotIndexByColumn: {} }}
        />
      )}
    </box>
  );
}

function CommandBar({ state }: { state: WatchtowerShellState }) {
  const model = createShellBarModel(state);

  return (
    <box flexDirection="column" id="watchtower-command-bar">
      {model.commandLines.map((line) => (
        <text key={line}>{line}</text>
      ))}
    </box>
  );
}

function StatusBar({ state }: { state: WatchtowerShellState }) {
  const model = createShellBarModel(state);

  return (
    <box flexDirection="column" id="watchtower-status-bar">
      {model.statusLines.map((line, index) => (
        <text fg={index === 2 ? "#F9E2AF" : state.searchFocused && index === 3 ? "#A6E3A1" : "#A6ADC8"} key={line}>
          {line}
        </text>
      ))}
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

function getPreflightLineColor(index: number, lineCount: number): string | undefined {
  if (index === 0) {
    return "#F38BA8";
  }

  if (index === lineCount - 1) {
    return "#F9E2AF";
  }

  return undefined;
}
