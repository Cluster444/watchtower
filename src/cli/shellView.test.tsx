import { describe, expect, test } from "bun:test";
import { WatchtowerShell } from "./shellView";
import type { WatchtowerShellState } from "./shell";
import type { IssueBoard } from "../issues/issueBoard";

describe("WatchtowerShell", () => {
  test("renders the active shell frame in layout order without unloaded mutation commands", () => {
    const state: WatchtowerShellState = {
      moveMenuOpen: false,
      searchFocused: false,
      searchQuery: "",
      preflight: { ok: true },
      screen: "triage",
      status: "Loading GitHub issues",
    };

    const shell = WatchtowerShell({ state }) as { props: { children: unknown } };
    const children = shell.props.children as Array<{ type: { name: string }; props: { children?: unknown } }>;

    expect(children.map((child) => child.type.name)).toEqual(["Header", "BoardArea", "CommandBar", "StatusBar"]);

    const commandBarText = flattenText(renderElement(children[2]));
    expect(commandBarText).toContain("/ search");
    expect(commandBarText).not.toContain("m move");
    expect(commandBarText).not.toContain("p mark ready");
  });

  test("renders empty-column commands without selected-issue actions", () => {
    const state: WatchtowerShellState = {
      boardState: {
        board: emptyColumnBoard(),
        cursor: { columnIndex: 1, slotIndexByColumn: { 0: 0, 1: undefined } },
        screen: "triage",
        selection: { screen: "triage", laneKey: "needs-triage", cardIndex: 0 },
        status: "Selection moved",
      } as unknown as WatchtowerShellState["boardState"],
      moveMenuOpen: false,
      searchFocused: false,
      searchQuery: "",
      preflight: { ok: true },
      screen: "triage",
      status: "Selection moved",
    };

    const shell = WatchtowerShell({ state }) as { props: { children: unknown } };
    const children = shell.props.children as Array<{ type: { name: string }; props: { children?: unknown } }>;
    const commandBarText = flattenText(renderElement(children[2]));

    expect(commandBarText).toContain("h/l or arrows column");
    expect(commandBarText).not.toContain("m move");
    expect(commandBarText).not.toContain("p mark ready");
    expect(commandBarText).not.toContain("o open");
  });

  test("renders search mode in the command bar", () => {
    const state: WatchtowerShellState = {
      moveMenuOpen: false,
      searchFocused: true,
      searchQuery: "oauth",
      preflight: { ok: true },
      screen: "triage",
      status: "Search: oauth",
    };

    const shell = WatchtowerShell({ state }) as { props: { children: unknown } };
    const children = shell.props.children as Array<{ type: { name: string }; props: { children?: unknown } }>;
    const commandBarText = flattenText(renderElement(children[2]));

    expect(commandBarText).toBe("Search: oauth | type to filter | Backspace clear | Esc cancel");
  });
});

function flattenText(node: unknown): string {
  if (node === undefined || node === null || typeof node === "boolean") {
    return "";
  }

  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(flattenText).join("");
  }

  if (typeof node === "object" && "props" in node) {
    return flattenText((node as { props: { children?: unknown } }).props.children);
  }

  return "";
}

function renderElement(node: unknown): unknown {
  if (typeof node === "object" && node !== null && "type" in node && "props" in node) {
    const element = node as { type: unknown; props: object };
    if (typeof element.type === "function") {
      return element.type(element.props);
    }
  }

  return node;
}

function emptyColumnBoard(): IssueBoard {
  return {
    triage: {
      inbox: lane("Inbox", [card(101)]),
      "needs-triage": lane("Needs triage", []),
      "needs-info": lane("Needs info", []),
      "ready-for-human": lane("Ready for human", []),
      "ready-for-agent": lane("Ready for agent", []),
      wontfix: lane("Wontfix", []),
      conflicted: lane("Conflicted", []),
    },
    run: {
      readyToRun: lane("Ready to run", []),
      closed: lane("Closed", []),
    },
  };
}

function lane(title: string, cards: IssueBoard["triage"]["inbox"]["cards"]) {
  return { title, cards, emptyState: `No ${title.toLowerCase()} issues.` };
}

function card(number: number) {
  return {
    bodyPreview: "plain preview",
    number,
    title: `Issue ${number}`,
    updatedAge: "1h ago",
    updatedAt: "2026-05-22T12:00:00Z",
    workflowLabels: [],
  };
}
