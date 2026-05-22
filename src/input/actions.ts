export type WatchtowerAction =
  | "switchToTriage"
  | "switchToRun"
  | "moveSelectionUp"
  | "moveSelectionDown"
  | "moveSelectionLeft"
  | "moveSelectionRight"
  | "openMoveMenu"
  | "markReadyToRun"
  | "unmarkReadyToRun"
  | "refresh"
  | "focusSearch"
  | "clearSearch"
  | "openSelectedIssue"
  | "confirmDestructiveAction"
  | "cancel"
  | "retryPreflight"
  | "exit";

export type RawInputEvent =
  | { type: "key"; key: string }
  | { type: "mouse"; sequence?: string }
  | { type: "terminal"; sequence: string };

const KEY_BINDINGS: ReadonlyMap<string, WatchtowerAction> = new Map([
  ["1", "switchToTriage"],
  ["t", "switchToTriage"],
  ["2", "switchToRun"],
  ["r", "switchToRun"],
  ["up", "moveSelectionUp"],
  ["k", "moveSelectionUp"],
  ["down", "moveSelectionDown"],
  ["j", "moveSelectionDown"],
  ["left", "moveSelectionLeft"],
  ["h", "moveSelectionLeft"],
  ["right", "moveSelectionRight"],
  ["l", "moveSelectionRight"],
  ["m", "openMoveMenu"],
  ["p", "markReadyToRun"],
  ["u", "unmarkReadyToRun"],
  ["ctrl+r", "refresh"],
  ["/", "focusSearch"],
  ["escape", "cancel"],
  ["esc", "cancel"],
  ["ctrl+c", "exit"],
  ["q", "exit"],
  ["enter", "confirmDestructiveAction"],
  ["o", "openSelectedIssue"],
  ["backspace", "clearSearch"],
  ["ctrl+l", "clearSearch"],
]);

const TERMINAL_BINDINGS: ReadonlyMap<string, WatchtowerAction> = new Map([
  ["\x1b[A", "moveSelectionUp"],
  ["\x1b[B", "moveSelectionDown"],
  ["\x1b[D", "moveSelectionLeft"],
  ["\x1b[C", "moveSelectionRight"],
  ["\x1b", "cancel"],
  ["\x03", "exit"],
  ["\x12", "refresh"],
  ["\r", "confirmDestructiveAction"],
  ["\n", "confirmDestructiveAction"],
]);

export function mapInputToAction(inputEvent: RawInputEvent): WatchtowerAction | undefined {
  switch (inputEvent.type) {
    case "mouse":
      return undefined;
    case "terminal":
      return TERMINAL_BINDINGS.get(inputEvent.sequence);
    case "key":
      return KEY_BINDINGS.get(normalizeKey(inputEvent.key));
  }
}

function normalizeKey(key: string): string {
  return key.trim().toLowerCase();
}
