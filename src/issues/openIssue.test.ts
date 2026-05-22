import { describe, expect, test } from "bun:test";
import { openIssueInBrowser, type BrowserOpenProcess } from "./openIssue";

describe("openIssueInBrowser", () => {
  test("opens with the platform command when an opener is available", async () => {
    const calls: string[][] = [];
    const result = await openIssueInBrowser("https://github.com/Cluster444/watchtower/issues/5", {
      env: { DISPLAY: ":1" },
      platform: "linux",
      process: fakeOpenProcess(calls, 0),
    });

    expect(result).toEqual({ opened: true });
    expect(calls).toEqual([["xdg-open", "https://github.com/Cluster444/watchtower/issues/5"]]);
  });

  test("falls back to the issue URL in headless terminal conditions", async () => {
    const result = await openIssueInBrowser("https://github.com/Cluster444/watchtower/issues/5", {
      env: { SSH_TTY: "/dev/pts/1", TMUX: "/tmp/tmux" },
      platform: "linux",
      process: fakeOpenProcess([], 0),
    });

    expect(result).toEqual({
      opened: false,
      fallbackUrl: "https://github.com/Cluster444/watchtower/issues/5",
      reason: "No browser opener is available in this terminal session.",
    });
  });

  test("falls back to the issue URL when the opener exits nonzero", async () => {
    const result = await openIssueInBrowser("https://github.com/Cluster444/watchtower/issues/5", {
      env: { DISPLAY: ":1" },
      platform: "linux",
      process: fakeOpenProcess([], 1, "failed"),
    });

    expect(result).toEqual({
      opened: false,
      fallbackUrl: "https://github.com/Cluster444/watchtower/issues/5",
      reason: "Browser open failed: failed",
    });
  });
});

function fakeOpenProcess(calls: string[][], exitCode: number, stderr = ""): BrowserOpenProcess {
  return {
    async run(command, args) {
      calls.push([command, ...args]);
      return { exitCode, stdout: "", stderr };
    },
  };
}
