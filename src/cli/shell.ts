import { Box, Text, createCliRenderer } from "@opentui/core";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { mapInputToAction, type WatchtowerAction } from "../input/actions";
import { GhIssueGateway } from "../issues/githubGateway";
import { classifyIssueBoard, renderIssueBoardLines, type IssueBoard } from "../issues/issueBoard";
import { parseLabelVocabulary } from "../setup/labelVocabulary";
import { runSetupPreflight, type SetupFailure, type SetupPreflightResult } from "../setup/preflight";
import { formatPreflightFailureLines } from "../setup/preflightScreen";

export type WatchtowerScreen = "triage" | "run";

export type WatchtowerShellState = {
  board?: IssueBoard;
  preflight: SetupPreflightResult;
  screen: WatchtowerScreen;
  status: string;
};

const WATCHTOWER_SHELL_ID = "watchtower-shell";

const SCREEN_LABELS: Record<WatchtowerScreen, string> = {
  triage: "Triage",
  run: "Run",
};

const ACTIONS_ALLOWED_DURING_FAILED_PREFLIGHT: ReadonlySet<WatchtowerAction> = new Set([
  "exit",
  "refresh",
  "retryPreflight",
]);

export function reduceShellState(
  state: WatchtowerShellState,
  action: WatchtowerAction,
): WatchtowerShellState {
  if (isBlockedByPreflight(state, action)) {
    return state;
  }

  switch (action) {
    case "switchToTriage":
      return { ...state, screen: "triage", status: "Triage screen selected" };
    case "switchToRun":
      return { ...state, screen: "run", status: "Run screen selected" };
    case "refresh":
      return { ...state, status: "Refresh requested" };
    case "focusSearch":
      return { ...state, status: "Search placeholder" };
    case "openMoveMenu":
      return { ...state, status: "Move menu placeholder" };
    case "markReadyToRun":
      return { ...state, status: "Mark ready placeholder" };
    case "unmarkReadyToRun":
      return { ...state, status: "Unmark ready placeholder" };
    case "openSelectedIssue":
      return { ...state, status: "Open issue placeholder" };
    case "retryPreflight":
      return { ...state, status: "Retrying setup preflight" };
    case "clearSearch":
      return { ...state, status: "Search cleared" };
    case "cancel":
      return { ...state, status: "Canceled" };
    case "confirmDestructiveAction":
      return { ...state, status: "Confirmed placeholder" };
    case "moveSelectionUp":
    case "moveSelectionDown":
    case "moveSelectionLeft":
    case "moveSelectionRight":
      return { ...state, status: "Selection movement placeholder" };
    case "exit":
      return state;
  }
}

export function createWatchtowerShellView(state: WatchtowerShellState) {
  if (!state.preflight.ok) {
    return createPreflightFailureView(state.preflight.failures);
  }

  return Box(
    {
      borderStyle: "rounded",
      flexDirection: "column",
      gap: 1,
      height: "100%",
      id: WATCHTOWER_SHELL_ID,
      padding: 1,
      width: "100%",
    },
    Text({ content: "Watchtower", fg: "#8BD5CA" }),
    Text({ content: `Screen: ${SCREEN_LABELS[state.screen]}` }),
    Text({ content: state.status, fg: "#F9E2AF" }),
    ...renderBoardText(state),
    Text({ content: "1/t triage | 2/r run | / search | Ctrl+R refresh | q exit" }),
  );
}

function createPreflightFailureView(failures: SetupFailure[]) {
  const lines = formatPreflightFailureLines(failures);
  return Box(
    {
      borderStyle: "rounded",
      flexDirection: "column",
      gap: 1,
      height: "100%",
      id: WATCHTOWER_SHELL_ID,
      padding: 1,
      width: "100%",
    },
    ...lines.map((line, index) =>
      Text({
        content: line,
        fg: getPreflightLineColor(index, lines.length),
      }),
    ),
  );
}

function isBlockedByPreflight(state: WatchtowerShellState, action: WatchtowerAction): boolean {
  return !state.preflight.ok && !ACTIONS_ALLOWED_DURING_FAILED_PREFLIGHT.has(action);
}

function isPreflightRetryAction(action: WatchtowerAction): boolean {
  return action === "retryPreflight" || action === "refresh";
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

export async function runWatchtowerCli(): Promise<void> {
  const renderer = await createCliRenderer({
    exitOnCtrlC: false,
    useMouse: false,
  });

  let state: WatchtowerShellState = {
    preflight: await runSetupPreflight(),
    screen: "triage",
    status: "CLI shell ready",
  };
  let hasRenderedShell = false;

  const render = () => {
    if (hasRenderedShell) {
      renderer.root.remove(WATCHTOWER_SHELL_ID);
    }

    renderer.root.add(createWatchtowerShellView(state));
    hasRenderedShell = true;
  };

  const retrySetupPreflight = () => {
    state = {
      ...state,
      status: "Retrying setup preflight",
    };
    render();

    void runSetupPreflight().then((preflight) => {
      state = {
        ...state,
        preflight,
        status: "Setup preflight retried",
      };
      render();
    });
  };

  const refreshIssueBoard = () => {
    if (!state.preflight.ok) {
      return;
    }

    state = { ...state, status: "Loading GitHub issues" };
    render();

    void loadIssueBoard(process.cwd())
      .then((board) => {
        state = {
          ...state,
          board,
          status: "GitHub issues loaded",
        };
        render();
      })
      .catch((error) => {
        state = {
          ...state,
          status: `Failed to load GitHub issues: ${formatErrorMessage(error)}`,
        };
        render();
      });
  };

  renderer.addInputHandler((inputSequence) => {
    const action = mapInputToAction({ type: "terminal", sequence: inputSequence });
    if (action === undefined) {
      return false;
    }

    if (action === "exit") {
      renderer.destroy();
      return true;
    }

    if (isPreflightRetryAction(action) && !state.preflight.ok) {
      retrySetupPreflight();
      return true;
    }

    state = reduceShellState(state, action);
    render();
    if (action === "refresh" && state.preflight.ok) {
      refreshIssueBoard();
    }
    return true;
  });

  render();
  refreshIssueBoard();
}

export async function loadIssueBoard(cwd: string): Promise<IssueBoard> {
  const labelDoc = await readFile(join(cwd, "docs", "agents", "triage-labels.md"), "utf8");
  const vocabulary = parseLabelVocabulary(labelDoc);
  if ("error" in vocabulary) {
    throw new Error(vocabulary.error.message);
  }

  const gateway = new GhIssueGateway({ cwd });
  const issueSets = await gateway.loadIssueSets();
  return classifyIssueBoard(issueSets, vocabulary);
}

function renderBoardText(state: WatchtowerShellState) {
  if (state.board === undefined) {
    return [Text({ content: "Issue board has not loaded yet." })];
  }

  return renderIssueBoardLines(state.board, state.screen).map((line) =>
    Text({
      content: line,
      fg: line.startsWith("#") ? "#CDD6F4" : "#A6ADC8",
    }),
  );
}

function formatErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
