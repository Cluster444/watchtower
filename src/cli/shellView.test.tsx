import { describe, expect, test } from "bun:test";
import { WatchtowerShell } from "./shellView";
import type { WatchtowerShellState } from "./shell";

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
        cursor: { columnIndex: 1, slotIndexByColumn: { 0: 0, 1: undefined } },
        selection: { screen: "triage", laneKey: "needs-triage", cardIndex: 0 },
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

    expect(commandBarText).toContain("h/l column");
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
