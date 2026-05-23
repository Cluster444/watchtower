// Parallel Planner with Review — four-phase orchestration loop
//
// This template drives a multi-phase workflow:
//   Phase 1 (Plan):             An opus agent analyzes open issues, builds a
//                               dependency graph, and outputs a <plan> JSON
//                               listing unblocked issues with branch names.
//   Phase 2 (Execute + Review): For each issue, a sandbox is created via
//                               createSandbox(). The implementer runs first
//                               (100 iterations). If it produces commits, a
//                               reviewer runs in the same sandbox on the same
//                               branch (1 iteration). All issue pipelines run
//                               concurrently via Promise.allSettled().
//   Phase 3 (Merge):            A single agent merges all completed branches
//                               into the current branch.
//
// The outer loop repeats up to MAX_ITERATIONS times so that newly unblocked
// issues are picked up after each round of merges.
//
// Usage:
//   npx tsx .sandcastle/main.mts
// Or add to package.json:
//   "scripts": { "sandcastle": "npx tsx .sandcastle/main.mts" }

import * as sandcastle from "@ai-hero/sandcastle";
import { podman } from "@ai-hero/sandcastle/sandboxes/podman";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

// Maximum number of plan→execute→merge cycles before stopping.
// Raise this if your backlog is large; lower it for a quick smoke-test run.
const MAX_ITERATIONS = 10;

// Hooks run inside the sandbox before the agent starts each iteration.
// npm install ensures the sandbox always has fresh dependencies.
const hooks = {
  sandbox: { onSandboxReady: [{ command: "npm install" }] },
};

// Copy node_modules from the host into the worktree before each sandbox
// starts. Avoids a full npm install from scratch; the hook above handles
// platform-specific binaries and any packages added since the last copy.
const copyToWorktree = ["node_modules"];

const SANDBOX_IMAGE = "sandcastle:watchtower";
const HOST_CODEX_DIR = join(homedir(), ".codex");
const HOST_CODEX_AUTH = join(HOST_CODEX_DIR, "auth.json");

const loadEnvFile = (path: string) => {
  if (!existsSync(path)) {
    return;
  }

  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith("#")) {
      continue;
    }

    const separator = trimmed.indexOf("=");
    if (separator === -1) {
      continue;
    }

    const key = trimmed.slice(0, separator).trim();
    const rawValue = trimmed.slice(separator + 1).trim();
    const value = rawValue.replace(/^(['"])(.*)\1$/, "$2");

    process.env[key] ??= value;
  }
};

const git = (args: string[]) =>
  execFileSync("git", args, { encoding: "utf8" }).trim();

const run = (command: string, args: string[]) =>
  execFileSync(command, args, { encoding: "utf8", stdio: "pipe" }).trim();

const requireCommand = (command: string, installHint: string) => {
  try {
    run(command, ["--version"]);
  } catch {
    throw new Error(`${command} is required. ${installHint}`);
  }
};

const requireEnv = (name: string) => {
  if (!process.env[name]) {
    throw new Error(
      `${name} is required. Set it in the environment or .sandcastle/.env before running Sandcastle.`,
    );
  }
};

const requireSandboxCommand = (command: string) => {
  try {
    run("podman", [
      "run",
      "--rm",
      "--entrypoint",
      command,
      SANDBOX_IMAGE,
      "--version",
    ]);
  } catch {
    throw new Error(
      `Sandbox image ${SANDBOX_IMAGE} must provide ${command}. Rebuild it with sandcastle podman build-image.`,
    );
  }
};

const requireCleanWorktree = () => {
  const status = git(["status", "--porcelain", "--untracked-files=all"]);
  if (status.length > 0) {
    throw new Error(
      `Refusing to start Sandcastle run from a dirty worktree. Commit or stash these changes first:\n${status}`,
    );
  }
};

const requirePreflight = () => {
  requireEnv("GH_TOKEN");
  requireCommand("git", "Install git and retry.");
  requireCommand("podman", "Install Podman and retry.");

  if (!existsSync(HOST_CODEX_AUTH)) {
    throw new Error(
      `${HOST_CODEX_AUTH} is required so Codex can authenticate inside the sandbox. Run codex login on the host first.`,
    );
  }

  if (!existsSync("node_modules") || !statSync("node_modules").isDirectory()) {
    throw new Error(
      "node_modules is required because Sandcastle copies it into worktrees. Run npm install first.",
    );
  }

  try {
    run("podman", ["image", "inspect", SANDBOX_IMAGE]);
  } catch {
    throw new Error(
      `Sandbox image ${SANDBOX_IMAGE} is missing. Build it with sandcastle podman build-image before running Sandcastle.`,
    );
  }

  requireSandboxCommand("bun");
  requireSandboxCommand("rg");
  requireSandboxCommand("gh");
};

loadEnvFile(".sandcastle/.env");
requirePreflight();
requireCleanWorktree();

// Review agents compare their issue branch against the branch that started the
// run. Do not assume the repository's default branch is named main or master.
const sourceBranch = git(["rev-parse", "--abbrev-ref", "HEAD"]);

if (sourceBranch === "HEAD") {
  throw new Error("Refusing to start Sandcastle run from a detached HEAD.");
}

const sandboxProvider = () =>
  podman({
    imageName: SANDBOX_IMAGE,
    env: { GH_TOKEN: process.env.GH_TOKEN! },
    mounts: [
      {
        hostPath: HOST_CODEX_DIR,
        sandboxPath: "~/.codex",
      },
    ],
  });

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------

for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration++) {
  console.log(`\n=== Iteration ${iteration}/${MAX_ITERATIONS} ===\n`);

  // -------------------------------------------------------------------------
  // Phase 1: Plan
  //
  // The planning agent (opus, for deeper reasoning) reads the open issue list,
  // builds a dependency graph, and selects the issues that can be worked in
  // parallel right now (i.e., no blocking dependencies on other open issues).
  //
  // It outputs a <plan> JSON block — we parse that to drive Phase 2.
  // -------------------------------------------------------------------------
  const plan = await sandcastle.run({
    hooks,
    sandbox: sandboxProvider(),
    name: "planner",
    // One iteration is enough: the planner just needs to read and reason,
    // not write code.
    maxIterations: 1,
    // Opus for planning: dependency analysis benefits from deeper reasoning.
    agent: sandcastle.codex("gpt-5.5", { effort: "low" }),
    promptFile: "./.sandcastle/plan-prompt.md",
  });

  // Extract the <plan>…</plan> block from the agent's stdout.
  const planMatch = plan.stdout.match(/<plan>([\s\S]*?)<\/plan>/);
  if (!planMatch) {
    throw new Error(
      "Planning agent did not produce a <plan> tag.\n\n" + plan.stdout,
    );
  }

  // The plan JSON contains an array of issues, each with id, title, branch.
  const { issues } = JSON.parse(planMatch[1]!) as {
    issues: { id: string; title: string; branch: string }[];
  };

  if (issues.length === 0) {
    // No unblocked work — either everything is done or everything is blocked.
    console.log("No unblocked issues to work on. Exiting.");
    break;
  }

  console.log(
    `Planning complete. ${issues.length} issue(s) to work in parallel:`,
  );
  for (const issue of issues) {
    console.log(`  ${issue.id}: ${issue.title} → ${issue.branch}`);
  }

  // -------------------------------------------------------------------------
  // Phase 2: Execute + Review
  //
  // For each issue, create a sandbox via createSandbox() so the implementer
  // and reviewer share the same sandbox instance per branch. The implementer
  // runs first; if it produces commits, the reviewer runs in the same sandbox.
  //
  // Promise.allSettled means one failing pipeline doesn't cancel the others.
  // -------------------------------------------------------------------------

  const settled = await Promise.allSettled(
    issues.map(async (issue) => {
      const sandbox = await sandcastle.createSandbox({
        branch: issue.branch,
        sandbox: sandboxProvider(),
        hooks,
        copyToWorktree,
      });

      try {
        // Run the implementer
        const implement = await sandbox.run({
          name: "implementer",
          maxIterations: 100,
          agent: sandcastle.codex("gpt-5.5", { effort: "low" }),
          promptFile: "./.sandcastle/implement-prompt.md",
          promptArgs: {
            TASK_ID: issue.id,
            ISSUE_TITLE: issue.title,
            BRANCH: issue.branch,
          },
        });

        // Only review if the implementer produced commits
        if (implement.commits.length > 0) {
          const review = await sandbox.run({
            name: "reviewer",
            maxIterations: 1,
            agent: sandcastle.codex("gpt-5.5", { effort: "xhigh" }),
            promptFile: "./.sandcastle/review-prompt.md",
            promptArgs: {
              SOURCE_BRANCH: sourceBranch,
              BRANCH: issue.branch,
            },
          });

          // Merge commits from both runs so the merge phase sees all of them.
          // Each sandbox.run() only returns commits from its own run.
          return {
            ...review,
            commits: [...implement.commits, ...review.commits],
          };
        }

        return implement;
      } finally {
        await sandbox.close();
      }
    }),
  );

  // Log any agents that threw (network error, sandbox crash, etc.).
  for (const [i, outcome] of settled.entries()) {
    if (outcome.status === "rejected") {
      console.error(
        `  ✗ ${issues[i]!.id} (${issues[i]!.branch}) failed: ${outcome.reason}`,
      );
    }
  }

  // Only pass branches that actually produced commits to the merge phase.
  // An agent that ran successfully but made no commits has nothing to merge.
  const completedIssues = settled
    .map((outcome, i) => ({ outcome, issue: issues[i]! }))
    .filter(
      (entry) =>
        entry.outcome.status === "fulfilled" &&
        entry.outcome.value.commits.length > 0,
    )
    .map((entry) => entry.issue);

  const completedBranches = completedIssues.map((i) => i.branch);

  console.log(
    `\nExecution complete. ${completedBranches.length} branch(es) with commits:`,
  );
  for (const branch of completedBranches) {
    console.log(`  ${branch}`);
  }

  if (completedBranches.length === 0) {
    // All agents ran but none made commits — nothing to merge this cycle.
    console.log("No commits produced. Nothing to merge.");
    continue;
  }

  // -------------------------------------------------------------------------
  // Phase 3: Merge
  //
  // One agent merges all completed branches into the current branch,
  // resolving any conflicts and running tests to confirm everything works.
  //
  // The {{BRANCHES}} and {{ISSUES}} prompt arguments are lists that the agent
  // uses to know which branches to merge and which issues to close.
  // -------------------------------------------------------------------------
  await sandcastle.run({
    hooks,
    sandbox: sandboxProvider(),
    name: "merger",
    maxIterations: 1,
    agent: sandcastle.codex("gpt-5.5", { effort: "xhigh" }),
    promptFile: "./.sandcastle/merge-prompt.md",
    promptArgs: {
      // A markdown list of branch names, one per line.
      BRANCHES: completedBranches.map((b) => `- ${b}`).join("\n"),
      // A markdown list of issue IDs and titles, one per line.
      ISSUES: completedIssues
        .map((i) => `- #${i.id}: ${i.title}`)
        .join("\n"),
    },
  });

  console.log("\nBranches merged.");
}

console.log("\nAll done.");
