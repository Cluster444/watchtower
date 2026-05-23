import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createElement } from "react";
import { mapInputToAction, type WatchtowerAction } from "../input/actions";
import { filterIssueKanban } from "../components/issues/issueKanbanFilter";
import {
  createBoardState,
  getSelectedCard,
  getSelectedIssueUrl,
  markSelectedIssueReadyToRun,
  moveSelectedIssueToTriageDestination,
  reduceBoardState,
  refreshBoardState,
  unmarkSelectedIssueReadyToRun,
  type BoardState,
  type BoardStateAction,
  type ReadyToRunOptions,
  type TriageMoveOptions,
} from "../issues/boardState";
import { GhIssueGateway } from "../issues/githubGateway";
import { openIssueInBrowser } from "../issues/openIssue";
import { classifyIssueBoard, type IssueBoard } from "../issues/issueBoard";
import {
  requiresTriageMoveConfirmation,
  type IssueMutationGateway,
  type TriageMoveDestination,
} from "../issues/triageActions";
import { parseLabelVocabulary, type LabelVocabulary } from "../setup/labelVocabulary";
import { runSetupPreflight, type SetupPreflightResult } from "../setup/preflight";
import { WatchtowerShell } from "./shellView";

export type WatchtowerScreen = "triage" | "run";

export type WatchtowerShellState = {
  board?: IssueBoard;
  boardState?: BoardState;
  labelVocabulary?: LabelVocabulary;
  moveMenuOpen: boolean;
  pendingDestructiveMove?: TriageMoveDestination;
  pendingReadyToRunPromotion?: boolean;
  preflight: SetupPreflightResult;
  screen: WatchtowerScreen;
  searchFocused: boolean;
  searchQuery: string;
  status: string;
};

const ACTIONS_ALLOWED_DURING_FAILED_PREFLIGHT: ReadonlySet<WatchtowerAction> = new Set([
  "exit",
  "refresh",
  "retryPreflight",
]);
const CONFIRMATION_REQUIRED_STATUS_FRAGMENT = "requires confirmation";
const RENDERER_SHUTDOWN_SIGNALS = ["SIGINT", "SIGTERM"] as const;

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
      return { ...state, searchFocused: true, status: "Search focused" };
    case "openMoveMenu":
      return state.boardState === undefined || getSelectedCard(state.boardState) === undefined
        ? { ...state, status: "No issue is selected." }
        : { ...state, moveMenuOpen: true, status: "Move menu opened" };
    case "markReadyToRun":
      return { ...state, status: "Mark ready to run requested" };
    case "unmarkReadyToRun":
      return { ...state, status: "Unmark ready to run requested" };
    case "openSelectedIssue":
      return { ...state, status: getSelectedIssueUrlFromShell(state) ?? "No issue is selected." };
    case "retryPreflight":
      return { ...state, status: "Retrying setup preflight" };
    case "clearSearch":
      return normalizeShellBoardCursor({ ...state, searchFocused: false, searchQuery: "", status: "Search cleared" });
    case "cancel":
      return cancelActivePrompt(state);
    case "confirmDestructiveAction":
      return confirmPendingAction(state);
    case "moveSelectionUp":
      if (isBoardNavigationBlocked(state)) return state;
      return applyBoardAction(state, { type: "moveSelectionUp" }, { status: "Selection movement placeholder" });
    case "moveSelectionDown":
      if (isBoardNavigationBlocked(state)) return state;
      return applyBoardAction(state, { type: "moveSelectionDown" }, { status: "Selection movement placeholder" });
    case "moveSelectionLeft":
      if (isBoardNavigationBlocked(state)) return state;
      return applyBoardAction(state, { type: "moveSelectionLeft" }, { status: "Selection movement placeholder" });
    case "moveSelectionRight":
      if (isBoardNavigationBlocked(state)) return state;
      return applyBoardAction(state, { type: "moveSelectionRight" }, { status: "Selection movement placeholder" });
    case "exit":
      return state;
  }
}

function isBoardNavigationBlocked(state: WatchtowerShellState): boolean {
  return (
    state.searchFocused ||
    state.moveMenuOpen ||
    state.pendingDestructiveMove !== undefined ||
    state.pendingReadyToRunPromotion === true
  );
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
    board: boardState.board,
    boardState,
    screen: boardState.screen,
    status: boardState.status,
  };
}

function normalizeShellBoardCursor(state: WatchtowerShellState): WatchtowerShellState {
  if (state.boardState === undefined) {
    return state;
  }

  const filtered = filterIssueKanban(
    state.boardState.board,
    state.screen,
    state.boardState.cursor,
    state.searchQuery,
  );

  return {
    ...state,
    boardState: {
      ...state.boardState,
      cursor: filtered.cursor,
    },
  };
}

function cancelActivePrompt(state: WatchtowerShellState): WatchtowerShellState {
  if (state.searchFocused) {
    return normalizeShellBoardCursor({ ...state, searchFocused: false, searchQuery: "", status: "Canceled" });
  }

  return clearPendingActionPrompt(state, { status: "Canceled" });
}

function clearPendingActionPrompt(
  state: WatchtowerShellState,
  patch: Pick<WatchtowerShellState, "status">,
): WatchtowerShellState {
  return {
    ...state,
    ...patch,
    moveMenuOpen: false,
    pendingDestructiveMove: undefined,
    pendingReadyToRunPromotion: undefined,
  };
}

function confirmPendingAction(state: WatchtowerShellState): WatchtowerShellState {
  if (state.pendingReadyToRunPromotion === true) {
    return {
      ...state,
      pendingReadyToRunPromotion: undefined,
      status: "Confirmed mark ready to run",
    };
  }

  if (state.pendingDestructiveMove === undefined) {
    return { ...state, status: "No destructive action is pending." };
  }

  return {
    ...state,
    pendingDestructiveMove: undefined,
    status: `Confirmed ${formatMoveMenuDestination(state.pendingDestructiveMove)}`,
  };
}

function isBlockedByPreflight(state: WatchtowerShellState, action: WatchtowerAction): boolean {
  return !state.preflight.ok && !ACTIONS_ALLOWED_DURING_FAILED_PREFLIGHT.has(action);
}

function isPreflightRetryAction(action: WatchtowerAction): boolean {
  return action === "retryPreflight" || action === "refresh";
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
    searchFocused: false,
    searchQuery: "",
    status: "CLI shell ready",
  };
  let isRendererDestroyed = false;
  const root = createRoot(renderer);

  const render = () => {
    if (isRendererDestroyed) {
      return;
    }

    root.render(createElement(WatchtowerShell, { state }));
  };

  const destroyRenderer = () => {
    if (isRendererDestroyed) {
      return;
    }

    isRendererDestroyed = true;
    root.unmount();
    renderer.destroy();
  };

  for (const signal of RENDERER_SHUTDOWN_SIGNALS) {
    process.once(signal, destroyRenderer);
  }

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

    const searchTextState = reduceShellSearchTextInput(state, inputSequence);
    if (searchTextState !== undefined) {
      state = searchTextState;
      render();
      return true;
    }

    const action = mapInputToAction({ type: "terminal", sequence: inputSequence });

    if (action === undefined) {
      return false;
    }

    if (action === "exit") {
      destroyRenderer();
      return true;
    }

    if (action === "confirmDestructiveAction" && state.pendingReadyToRunPromotion === true) {
      state = reduceShellState(state, action);
      render();
      void markReadyToRun({ confirmed: true });
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
    if (action === "markReadyToRun" && state.preflight.ok) {
      void markReadyToRun();
    }
    if (action === "unmarkReadyToRun" && state.preflight.ok) {
      void unmarkReadyToRun();
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

  function createShellIssueMutationGateway(): IssueMutationGateway {
    return createIssueMutationGateway(new GhIssueGateway({ cwd: process.cwd() }));
  }

  async function loadIssueBoardForMutation(): Promise<IssueBoard> {
    const data = await loadIssueBoard(process.cwd());
    state = { ...state, labelVocabulary: data.vocabulary };
    return data.board;
  }

  async function moveSelectedIssue(
    destination: TriageMoveDestination,
    options: TriageMoveOptions = {},
  ): Promise<void> {
    if (state.boardState === undefined || state.labelVocabulary === undefined) {
      state = clearPendingActionPrompt(state, { status: "No issue is selected." });
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

    state = syncShellWithBoardState(
      state,
      await moveSelectedIssueToTriageDestination(
        boardState,
        destination,
        labelVocabulary,
        createShellIssueMutationGateway(),
        loadIssueBoardForMutation,
        options,
      ),
    );
    if (isPendingDestructiveMove(destination, options, state.status)) {
      state = { ...state, pendingDestructiveMove: destination };
    }
    render();
  }

  async function markReadyToRun(options: ReadyToRunOptions = {}): Promise<void> {
    if (state.boardState === undefined || state.labelVocabulary === undefined) {
      state = { ...state, status: "No triage issue is selected." };
      render();
      return;
    }

    const boardState = state.boardState;
    const labelVocabulary = state.labelVocabulary;
    state = {
      ...state,
      moveMenuOpen: false,
      pendingReadyToRunPromotion: undefined,
      status: formatReadyToRunInProgressStatus(options),
    };
    render();

    state = syncShellWithBoardState(
      state,
      await markSelectedIssueReadyToRun(
        boardState,
        labelVocabulary,
        createShellIssueMutationGateway(),
        loadIssueBoardForMutation,
        options,
      ),
    );
    if (isPendingReadyToRunPromotion(options, state.status)) {
      state = { ...state, pendingReadyToRunPromotion: true };
    }
    render();
  }

  async function unmarkReadyToRun(): Promise<void> {
    if (state.boardState === undefined) {
      state = { ...state, status: "No run issue is selected." };
      render();
      return;
    }

    const boardState = state.boardState;
    state = {
      ...state,
      moveMenuOpen: false,
      pendingReadyToRunPromotion: undefined,
      status: "Unmarking selected issue ready to run",
    };
    render();

    state = syncShellWithBoardState(
      state,
      await unmarkSelectedIssueReadyToRun(
        boardState,
        createShellIssueMutationGateway(),
        loadIssueBoardForMutation,
      ),
    );
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

function formatReadyToRunInProgressStatus(options: ReadyToRunOptions): string {
  if (options.confirmed === true) {
    return "Marking selected issue ready to run";
  }

  return "Checking selected issue readiness";
}

function isConfirmationRequiredStatus(status: string): boolean {
  return status.includes(CONFIRMATION_REQUIRED_STATUS_FRAGMENT);
}

function isPendingDestructiveMove(
  destination: TriageMoveDestination,
  options: TriageMoveOptions,
  status: string,
): boolean {
  return (
    requiresTriageMoveConfirmation(destination) &&
    options.confirmed !== true &&
    isConfirmationRequiredStatus(status)
  );
}

function isPendingReadyToRunPromotion(options: ReadyToRunOptions, status: string): boolean {
  return options.confirmed !== true && isConfirmationRequiredStatus(status);
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

async function getRepositoryUrl(cwd: string): Promise<string | undefined> {
  const gateway = new GhIssueGateway({ cwd });
  return gateway.getRepositoryUrl();
}

function isSearchTextInput(inputSequence: string): boolean {
  return inputSequence.length === 1 && inputSequence >= " " && inputSequence !== "\x7f";
}

export function reduceShellSearchTextInput(
  state: WatchtowerShellState,
  inputSequence: string,
): WatchtowerShellState | undefined {
  if (!state.searchFocused || !isSearchTextInput(inputSequence)) {
    return undefined;
  }

  const searchQuery = `${state.searchQuery}${inputSequence}`;
  return normalizeShellBoardCursor({
    ...state,
    searchQuery,
    status: `Search: ${searchQuery}`,
  });
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
