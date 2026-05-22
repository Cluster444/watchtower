import { describe, expect, test } from "bun:test";
import { runSetupPreflight, type FileSystemAdapter, type ProcessRunner } from "./preflight";

const VALID_LABEL_DOC = `
| Label in mattpocock/skills | Label in our tracker |
| -------------------------- | -------------------- |
| \`needs-triage\` | needs-triage |
| \`needs-info\` | needs-info |
| \`ready-for-agent\` | ready-for-agent |
| \`ready-for-human\` | ready-for-human |
| \`wontfix\` | wontfix |
`;

describe("runSetupPreflight", () => {
  test("aggregates every detected setup failure with remediation", async () => {
    const result = await runSetupPreflight({
      cwd: "/repo",
      fs: fakeFs({}),
      process: fakeProcess({
        "git rev-parse --is-inside-work-tree": { exitCode: 1, stdout: "", stderr: "not a repo" },
        "git remote get-url origin": { exitCode: 2, stdout: "", stderr: "missing origin" },
        "gh auth status": { exitCode: 127, stdout: "", stderr: "gh not found" },
        "gh label list --limit 1000 --json name": {
          exitCode: 1,
          stdout: "",
          stderr: "no auth",
        },
      }),
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected setup preflight failures");
    }

    expect(result.failures.map((failure) => failure.code)).toEqual([
      "not-git-repo",
      "missing-github-origin",
      "gh-unavailable-or-unauthenticated",
      "missing-sandcastle-directory",
      "missing-triage-labels-file",
    ]);
    expect(result.failures.map((failure) => failure.remediation)).toContain(
      "Run sandcastle init outside Watchtower, then restart Watchtower.",
    );
    expect(result.failures.map((failure) => failure.remediation)).toContain(
      "Run /setup-matt-pocock-skills for this repo, then restart Watchtower.",
    );
  });

  test("distinguishes missing canonical labels from the missing Sandcastle label", async () => {
    const result = await runSetupPreflight({
      cwd: "/repo",
      fs: fakeFs({
        ".sandcastle": "directory",
        "docs/agents/triage-labels.md": VALID_LABEL_DOC,
      }),
      process: fakeProcess({
        "git rev-parse --is-inside-work-tree": { exitCode: 0, stdout: "true\n", stderr: "" },
        "git remote get-url origin": {
          exitCode: 0,
          stdout: "git@github.com:Cluster444/watchtower.git\n",
          stderr: "",
        },
        "gh auth status": { exitCode: 0, stdout: "ok", stderr: "" },
        "gh label list --limit 1000 --json name": {
          exitCode: 0,
          stdout: JSON.stringify([{ name: "needs-triage" }, { name: "ready-for-agent" }]),
          stderr: "",
        },
      }),
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected setup preflight failures");
    }

    expect(result.failures).toEqual([
      {
        code: "missing-canonical-labels",
        title: "Required canonical triage labels are missing",
        detail: "Missing GitHub labels: needs-info, ready-for-human, wontfix.",
        remediation: "Run /setup-matt-pocock-skills for this repo, then restart Watchtower.",
      },
      {
        code: "missing-sandcastle-label",
        title: "The Sandcastle GitHub label is missing",
        detail: "Missing exact GitHub label: Sandcastle.",
        remediation:
          "Complete Sandcastle label setup or create the exact Sandcastle GitHub label, then restart Watchtower.",
      },
    ]);
  });
});

function fakeFs(entries: Record<string, string | "directory">): FileSystemAdapter {
  return {
    async exists(path) {
      return Object.hasOwn(entries, relative(path));
    },
    async isDirectory(path) {
      return entries[relative(path)] === "directory";
    },
    async readFile(path) {
      const entry = entries[relative(path)];
      if (entry === undefined || entry === "directory") {
        throw new Error(`missing file: ${path}`);
      }

      return entry;
    },
  };
}

function fakeProcess(results: Record<string, Awaited<ReturnType<ProcessRunner["run"]>>>): ProcessRunner {
  return {
    async run(command, args) {
      const key = [command, ...args].join(" ");
      const result = results[key];
      if (result === undefined) {
        throw new Error(`missing fake process result: ${key}`);
      }

      return result;
    },
  };
}

function relative(path: string): string {
  return path.replace(/^\/repo\/?/, "");
}
