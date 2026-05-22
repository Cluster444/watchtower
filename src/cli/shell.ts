import { Box, Text, createCliRenderer } from "@opentui/core";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { mapInputToAction, type WatchtowerAction } from "../input/actions";
import {
  createBoardState,
  getSelectedIssueUrl,
  moveSelectedIssueToTriageDestination,
  reduceBoardState,
  refreshBoardState,
  type BoardState,
  type BoardStateAction,
  type TriageMoveOptions,
} from "../issues/boardState";
import { GhIssueGateway } from "../issues/githubGateway";
import { openIssueInBrowser } from "../issues/openIssue";
import { classifyIssueBoard, renderIssueBoardLines, type IssueBoard } from "../issues/issueBoard";
import {
  requiresTriageMoveConfirmation,
  type IssueMutationGateway,
  type TriageMoveDestination,
} from "../issues/triageActions";
import { parseLabelVocabulary, type LabelVocabulary } from "../setup/labelVocabulary";
import { runSetupPreflight, type SetupFailure, type SetupPreflightResult } from "../setup/preflight";
import { formatPreflightFailureLines } from "../setup/preflightScreen";

export type WatchtowerScreen = "triage" | "run";

export type WatchtowerShellState = {
  board?: IssueBoard;
  boardState?: BoardState;
  labelVocabulary?: LabelVocabulary;
  moveMenuOpen: boolean;
  pendingDestructiveMove?: TriageMoveDestination;
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
const MOVE_MENU_OPTIONS = [
  "0 Inbox",
  "1 needs-triage",
  "2 needs-info",
  "3 ready-for-agent",
  "4 ready-for-human",
  "5 Close as wontfix",
  "Esc cancel",
].join(" | ");
const CONFIRMATION_REQUIRED_STATUS_FRAGMENT = "requires confirmation";

export function reduceShellState(
  state: WatchtowerShellState,
  action: WatchtowerAction,
): WatchtowerShellState {
  if (isBlockedByPreflight(state, action)) {
    return state;
  }

  switch (action) {
    case "switchToTriage":
      return applyBoardAction(
        state,
        { type: "switchScreen", screen: "triage" },
        {
          screen: "triage",
          status: "Triage screen selected",
        },
      );
    case "switchToRun":
      return applyBoardAction(
        state,
        { type: "switchScreen", screen: "run" },
        {
          screen: "run",
          status: "Run screen selected",
        },
      );
    case "refresh":
      return { ...state, status: "Refresh requested" };
    case "focusSearch":
      return applyBoardAction(state, { type: "focusSearch" }, { status: "Search focused" });
    case "openMoveMenu":
      return state.boardState === undefined
        ? { ...state, status: "No issue is selected." }
        : { ...state, moveMenuOpen: true, status: "Move menu opened" };
    case "markReadyToRun":
      return { ...state, status: "Mark ready placeholder" };
    case "unmarkReadyToRun":
      return { ...state, status: "Unmark ready placeholder" };
    case "openSelectedIssue":
      return { ...state, status: getSelectedIssueUrlFromShell(state) ?? "No issue is selected." };
    case "retryPreflight":
      return { ...state, status: "Retrying setup preflight" };
    case "clearSearch":
      return applyBoardAction(state, { type: "clearSearch" }, { status: "Search cleared" });
    case "cancel":
      return cancelActivePrompt(state);
    case "confirmDestructiveAction":
      return confirmPendingDestructiveMove(state);
    case "moveSelectionUp":
      return applyBoardAction(state, { type: "moveSelectionUp" }, { status: "Selection movement placeholder" });
    case "moveSelectionDown":
      return applyBoardAction(state, { type: "moveSelectionDown" }, { status: "Selection movement placeholder" });
    case "moveSelectionLeft":
      return applyBoardAction(state, { type: "moveSelectionLeft" }, { status: "Selection movement placeholder" });
    case "moveSelectionRight":
      return applyBoardAction(state, { type: "moveSelectionRight" }, { status: "Selection movement placeholder" });
    case "exit":
      return state;
  }
}

function applyBoardAction(
  state: WatchtowerShellState,
  action: BoardStateAction,
  unloadedPatch: Partial<Pick<WatchtowerShellState, "screen" | "status">>,
): WatchtowerShellState {
  if (state.boardState === undefined) {
    return { ...state, ...unloadedPatch };
  }

  return syncShellWithBoardState(state, reduceBoardState(state.boardState, action));
}

function syncShellWithBoardState(state: WatchtowerShellState, boardState: BoardState): WatchtowerShellState {
  return {
    ...state,
    board: boardState.visibleBoard,
    boardState,
    screen: boardState.screen,
    status: boardState.status,
  };
}

function cancelActivePrompt(state: WatchtowerShellState): WatchtowerShellState {
  return clearMovePrompt(state, { status: "Canceled" });
}

function clearMovePrompt(
  state: WatchtowerShellState,
  patch: Pick<WatchtowerShellState, "status">,
): WatchtowerShellState {
  return {
    ...state,
    ...patch,
    moveMenuOpen: false,
    pendingDestructiveMove: undefined,
  };
}

function confirmPendingDestructiveMove(state: WatchtowerShellState): WatchtowerShellState {
  if (state.pendingDestructiveMove === undefined) {
    return { ...state, status: "No destructive action is pending." };
  }

  return {
    ...state,
    pendingDestructiveMove: undefined,
    status: `Confirmed ${formatMoveMenuDestination(state.pendingDestructiveMove)}`,
  };
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
    ...renderMoveMenuText(state),
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
    moveMenuOpen: false,
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

    const loadBoard = () => loadIssueBoard(process.cwd()).then((data) => data.board);
    const refresh =
      state.boardState === undefined
        ? loadIssueBoard(process.cwd()).then(async (data) => {
            state = { ...state, labelVocabulary: data.vocabulary };
            return createBoardState(data.board, {
              repositoryUrl: await getRepositoryUrl(process.cwd()),
              screen: state.screen,
            });
          })
        : refreshBoardState(state.boardState, loadBoard);

    void refresh
      .then((boardState) => {
        state = syncShellWithBoardState(state, boardState);
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
    if (state.moveMenuOpen && handleMoveMenuInput(inputSequence)) {
      return true;
    }

    const action = mapInputToAction({ type: "terminal", sequence: inputSequence });
    if (action === undefined && state.boardState?.searchFocused === true && isSearchTextInput(inputSequence)) {
      state = syncShellWithBoardState(
        state,
        reduceBoardState(state.boardState, {
          type: "setSearchQuery",
          query: `${state.boardState.searchQuery}${inputSequence}`,
        }),
      );
      render();
      return true;
    }

    if (action === undefined) {
      return false;
    }

    if (action === "exit") {
      renderer.destroy();
      return true;
    }

    if (action === "confirmDestructiveAction" && state.pendingDestructiveMove !== undefined) {
      const destination = state.pendingDestructiveMove;
      state = reduceShellState(state, action);
      render();
      void moveSelectedIssue(destination, { confirmed: true });
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
    if (action === "openSelectedIssue" && state.preflight.ok) {
      void openSelectedIssue();
    }
    return true;
  });

  async function openSelectedIssue(): Promise<void> {
    const url = getSelectedIssueUrlFromShell(state);
    if (url === undefined) {
      state = { ...state, status: "No issue is selected." };
      render();
      return;
    }

    const result = await openIssueInBrowser(url);
    if (result.opened === true) {
      state = { ...state, status: "Opened selected issue in GitHub" };
    } else {
      state = { ...state, status: `${result.reason} ${result.fallbackUrl}` };
    }
    render();
  }

  function handleMoveMenuInput(inputSequence: string): boolean {
    const destination = MOVE_MENU_DESTINATIONS.get(inputSequence);
    if (destination === undefined) {
      if (inputSequence === "\x1b") {
        state = cancelActivePrompt(state);
        render();
        return true;
      }
      return false;
    }

    void moveSelectedIssue(destination);
    return true;
  }

  async function moveSelectedIssue(
    destination: TriageMoveDestination,
    options: TriageMoveOptions = {},
  ): Promise<void> {
    if (state.boardState === undefined || state.labelVocabulary === undefined) {
      state = clearMovePrompt(state, { status: "No issue is selected." });
      render();
      return;
    }

    const boardState = state.boardState;
    const labelVocabulary = state.labelVocabulary;
    state = {
      ...state,
      moveMenuOpen: false,
      pendingDestructiveMove: undefined,
      status: formatMoveInProgressStatus(options),
    };
    render();

    const gateway = new GhIssueGateway({ cwd: process.cwd() });
    const loadBoard = () => loadIssueBoard(process.cwd()).then((data) => {
      state = { ...state, labelVocabulary: data.vocabulary };
      return data.board;
    });
    state = syncShellWithBoardState(
      state,
      await moveSelectedIssueToTriageDestination(
        boardState,
        destination,
        labelVocabulary,
        createIssueMutationGateway(gateway),
        loadBoard,
        options,
      ),
    );
    if (isPendingDestructiveMove(destination, options, state.status)) {
      state = { ...state, pendingDestructiveMove: destination };
    }
    render();
  }

  render();
  refreshIssueBoard();
}

export async function loadIssueBoard(cwd: string): Promise<{ board: IssueBoard; vocabulary: LabelVocabulary }> {
  const labelDoc = await readFile(join(cwd, "docs", "agents", "triage-labels.md"), "utf8");
  const vocabulary = parseLabelVocabulary(labelDoc);
  if ("error" in vocabulary) {
    throw new Error(vocabulary.error.message);
  }

  const gateway = new GhIssueGateway({ cwd });
  const issueSets = await gateway.loadIssueSets();
  return { board: classifyIssueBoard(issueSets, vocabulary), vocabulary };
}

function renderBoardText(state: WatchtowerShellState) {
  const board = state.boardState?.visibleBoard ?? state.board;
  if (board === undefined) {
    return [Text({ content: "Issue board has not loaded yet." })];
  }

  return [
    Text({
      content: `Search: ${state.boardState?.searchQuery ?? ""}`,
      fg: state.boardState?.searchFocused ? "#A6E3A1" : "#A6ADC8",
    }),
    Text({
      content: `Selected: ${renderSelectionSummary(state.boardState)}`,
      fg: "#A6ADC8",
    }),
    ...renderIssueBoardLines(board, state.screen).map((line) =>
      Text({
        content: line,
        fg: line.startsWith("#") ? "#CDD6F4" : "#A6ADC8",
      }),
    ),
  ];
}

function renderMoveMenuText(state: WatchtowerShellState) {
  if (!state.moveMenuOpen) {
    if (state.pendingDestructiveMove !== undefined) {
      return [
        Text({ content: `${formatMoveMenuDestination(state.pendingDestructiveMove)} requires confirmation.` }),
        Text({ content: "Enter confirm | Esc cancel" }),
      ];
    }
    return [];
  }

  return [
    Text({ content: "Move selected issue:" }),
    Text({ content: MOVE_MENU_OPTIONS }),
  ];
}

function formatMoveMenuDestination(destination: TriageMoveDestination): string {
  switch (destination) {
    case "wontfix":
      return "Close as wontfix";
    default:
      return destination;
  }
}

function formatMoveInProgressStatus(options: TriageMoveOptions): string {
  if (options.confirmed === true) {
    return "Closing selected issue as wontfix";
  }

  return "Moving selected issue";
}

function isPendingDestructiveMove(
  destination: TriageMoveDestination,
  options: TriageMoveOptions,
  status: string,
): boolean {
  return (
    requiresTriageMoveConfirmation(destination) &&
    options.confirmed !== true &&
    status.includes(CONFIRMATION_REQUIRED_STATUS_FRAGMENT)
  );
}

function formatErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function getSelectedIssueUrlFromShell(state: WatchtowerShellState): string | undefined {
  if (state.boardState === undefined) {
    return undefined;
  }

  return getSelectedIssueUrl(state.boardState);
}

function renderSelectionSummary(boardState: BoardState | undefined): string {
  if (boardState === undefined) {
    return "none";
  }

  return `${boardState.selection.laneKey} card ${boardState.selection.cardIndex + 1}`;
}

async function getRepositoryUrl(cwd: string): Promise<string | undefined> {
  const gateway = new GhIssueGateway({ cwd });
  return gateway.getRepositoryUrl();
}

function isSearchTextInput(inputSequence: string): boolean {
  return inputSequence.length === 1 && inputSequence >= " " && inputSequence !== "\x7f";
}

function createIssueMutationGateway(gateway: GhIssueGateway): IssueMutationGateway {
  return {
    addLabel: (issueNumber, label) => gateway.addLabel(issueNumber, label),
    closeIssue: (issueNumber) => gateway.closeIssue(issueNumber),
    refresh: async () => {},
    removeLabel: (issueNumber, label) => gateway.removeLabel(issueNumber, label),
  };
}

const MOVE_MENU_DESTINATIONS: ReadonlyMap<string, TriageMoveDestination> = new Map([
  ["0", "inbox"],
  ["1", "needs-triage"],
  ["2", "needs-info"],
  ["3", "ready-for-agent"],
  ["4", "ready-for-human"],
  ["5", "wontfix"],
]);
