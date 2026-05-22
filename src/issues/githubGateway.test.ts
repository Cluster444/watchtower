import { describe, expect, test } from "bun:test";
import { GhIssueGateway, type ProcessRunner } from "./githubGateway";

const ISSUE_JSON_FIELDS = "number,title,body,labels,state,updatedAt";

describe("GhIssueGateway", () => {
  test("builds bounded issue set queries with filters before the 100 issue limit", async () => {
    const calls: string[][] = [];
    const gateway = new GhIssueGateway({
      cwd: "/repo",
      process: fakeProcess(calls),
    });

    await gateway.loadIssueSets();

    expect(calls).toEqual([
      expectedIssueSearchCall("open", "-label:Sandcastle"),
      expectedIssueSearchCall("open", "label:Sandcastle"),
      expectedIssueSearchCall("closed", "label:Sandcastle"),
    ]);
  });

  test("normalizes GitHub issue fields from gh JSON output", async () => {
    const gateway = new GhIssueGateway({
      cwd: "/repo",
      process: fakeProcess(
        [],
        JSON.stringify([
          {
            body: null,
            labels: [{ name: "Sandcastle" }, "ready-for-agent", { color: "blue" }],
            number: 42,
            state: "open",
            title: "Load issue cards",
            updatedAt: "2026-05-22T12:00:00Z",
          },
        ]),
      ),
    });

    const issueSets = await gateway.loadIssueSets();

    expect(issueSets.readyToRunIssues[0]).toEqual({
      body: "",
      labels: ["Sandcastle", "ready-for-agent"],
      number: 42,
      state: "OPEN",
      title: "Load issue cards",
      updatedAt: "2026-05-22T12:00:00Z",
    });
  });

  test("loads the repository URL for issue links", async () => {
    const calls: string[][] = [];
    const gateway = new GhIssueGateway({
      cwd: "/repo",
      process: fakeProcess(calls, "https://github.com/Cluster444/watchtower\n"),
    });

    await expect(gateway.getRepositoryUrl()).resolves.toBe("https://github.com/Cluster444/watchtower");
    expect(calls).toEqual([["gh", "repo", "view", "--json", "url", "--jq", ".url"]]);
  });
});

function expectedIssueSearchCall(state: "open" | "closed", labelQualifier: string): string[] {
  return [
    "gh",
    "search",
    "issues",
    "--state",
    state,
    "--limit",
    "100",
    "--sort",
    "updated",
    "--order",
    "desc",
    "--json",
    ISSUE_JSON_FIELDS,
    "--",
    "is:issue",
    "no:pr",
    labelQualifier,
  ];
}

function fakeProcess(calls: string[][], stdout = "[]"): ProcessRunner {
  return {
    async run(command, args) {
      calls.push([command, ...args]);
      return { exitCode: 0, stdout, stderr: "" };
    },
  };
}
