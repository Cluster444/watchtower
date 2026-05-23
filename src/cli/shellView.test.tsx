import { describe, expect, test } from "bun:test";
import { WatchtowerShell } from "./shellView";
import type { WatchtowerShellState } from "./shell";

describe("WatchtowerShell", () => {
  test("renders the active shell frame in layout order without unloaded mutation commands", () => {
    const state: WatchtowerShellState = {
      moveMenuOpen: false,
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
