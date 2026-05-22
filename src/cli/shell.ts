import { Box, Text, createCliRenderer } from "@opentui/core";
import { mapInputToAction, type WatchtowerAction } from "../input/actions";

export type WatchtowerScreen = "triage" | "run";

export type WatchtowerShellState = {
  screen: WatchtowerScreen;
  status: string;
};

const WATCHTOWER_SHELL_ID = "watchtower-shell";

const SCREEN_LABELS: Record<WatchtowerScreen, string> = {
  triage: "Triage",
  run: "Run",
};

export function reduceShellState(
  state: WatchtowerShellState,
  action: WatchtowerAction,
): WatchtowerShellState {
  switch (action) {
    case "switchToTriage":
      return { screen: "triage", status: "Triage screen selected" };
    case "switchToRun":
      return { screen: "run", status: "Run screen selected" };
    case "refresh":
      return { ...state, status: "Refresh placeholder" };
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
      return { ...state, status: "Retry preflight placeholder" };
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
    Text({ content: "1/t triage | 2/r run | / search | Ctrl+R refresh | q exit" }),
  );
}

export async function runWatchtowerCli(): Promise<void> {
  const renderer = await createCliRenderer({
    exitOnCtrlC: false,
    useMouse: false,
  });

  let state: WatchtowerShellState = {
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

  renderer.addInputHandler((inputSequence) => {
    const action = mapInputToAction({ type: "terminal", sequence: inputSequence });
    if (action === undefined) {
      return false;
    }

    if (action === "exit") {
      renderer.destroy();
      return true;
    }

    state = reduceShellState(state, action);
    render();
    return true;
  });

  render();
}
