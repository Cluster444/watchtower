import { stat, readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseLabelVocabulary } from "./labelVocabulary";

export type SetupFailureCode =
  | "not-git-repo"
  | "missing-github-origin"
  | "gh-unavailable-or-unauthenticated"
  | "missing-sandcastle-directory"
  | "missing-triage-labels-file"
  | "invalid-triage-labels-file"
  | "missing-canonical-labels"
  | "missing-sandcastle-label";

export type SetupFailure = {
  code: SetupFailureCode;
  title: string;
  detail: string;
  remediation: string;
};

export type SetupPreflightResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      failures: SetupFailure[];
    };

export type ProcessResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

export type ProcessRunner = {
  run(command: string, args: string[], options: { cwd: string }): Promise<ProcessResult>;
};

export type FileSystemAdapter = {
  exists(path: string): Promise<boolean>;
  isDirectory(path: string): Promise<boolean>;
  readFile(path: string): Promise<string>;
};

export type SetupPreflightOptions = {
  cwd?: string;
  fs?: FileSystemAdapter;
  process?: ProcessRunner;
};

const SKILLS_REMEDIATION = "Run /setup-matt-pocock-skills for this repo, then restart Watchtower.";
const SANDCASTLE_INIT_REMEDIATION =
  "Run sandcastle init outside Watchtower, then restart Watchtower.";
const SANDCASTLE_LABEL_REMEDIATION =
  "Complete Sandcastle label setup or create the exact Sandcastle GitHub label, then restart Watchtower.";
const SANDCASTLE_LABEL = "Sandcastle";

export async function runSetupPreflight(
  options: SetupPreflightOptions = {},
): Promise<SetupPreflightResult> {
  const cwd = options.cwd ?? process.cwd();
  const fs = options.fs ?? nodeFileSystem;
  const processRunner = options.process ?? bunProcessRunner;

  const failures: SetupFailure[] = [];

  const gitRepo = await runCommand(processRunner, "git", ["rev-parse", "--is-inside-work-tree"], cwd);
  if (gitRepo.exitCode !== 0 || gitRepo.stdout.trim() !== "true") {
    failures.push({
      code: "not-git-repo",
      title: "Current directory is not a git repo",
      detail: "Watchtower must run inside the target repo.",
      remediation: "Change into the target git repo, then restart Watchtower.",
    });
  }

  const origin = await runCommand(processRunner, "git", ["remote", "get-url", "origin"], cwd);
  if (origin.exitCode !== 0 || !isGitHubRemote(origin.stdout.trim())) {
    failures.push({
      code: "missing-github-origin",
      title: "GitHub origin remote is missing",
      detail: "The target repo must have an origin remote that points at GitHub.",
      remediation: "Add a GitHub origin remote for this repo, then restart Watchtower.",
    });
  }

  const ghAuth = await runCommand(processRunner, "gh", ["auth", "status"], cwd);
  const canQueryGitHub = ghAuth.exitCode === 0;
  if (!canQueryGitHub) {
    failures.push({
      code: "gh-unavailable-or-unauthenticated",
      title: "GitHub CLI is missing or unauthenticated",
      detail: "Watchtower shells out to gh for GitHub issue and label operations.",
      remediation: "Install gh and run gh auth login, then restart Watchtower.",
    });
  }

  const sandcastlePath = join(cwd, ".sandcastle");
  if (!(await fs.isDirectory(sandcastlePath))) {
    failures.push({
      code: "missing-sandcastle-directory",
      title: "Sandcastle setup is missing",
      detail: ".sandcastle/ does not exist in this repo.",
      remediation: SANDCASTLE_INIT_REMEDIATION,
    });
  }

  const labelDocPath = join(cwd, "docs", "agents", "triage-labels.md");
  const labelDocExists = await fs.exists(labelDocPath);
  if (!labelDocExists) {
    failures.push({
      code: "missing-triage-labels-file",
      title: "Triage label setup is missing",
      detail: "docs/agents/triage-labels.md does not exist in this repo.",
      remediation: SKILLS_REMEDIATION,
    });
  }

  let requiredCanonicalLabels: string[] | undefined;
  if (labelDocExists) {
    const parsedVocabulary = parseLabelVocabulary(await fs.readFile(labelDocPath));
    if ("error" in parsedVocabulary) {
      failures.push({
        code: "invalid-triage-labels-file",
        title: "Triage label setup is invalid",
        detail: parsedVocabulary.error.message,
        remediation: SKILLS_REMEDIATION,
      });
    } else {
      requiredCanonicalLabels = Object.values(parsedVocabulary.labelsByRole);
    }
  }

  if (canQueryGitHub && requiredCanonicalLabels !== undefined) {
    const labelResult = await runCommand(
      processRunner,
      "gh",
      ["label", "list", "--limit", "1000", "--json", "name"],
      cwd,
    );
    if (labelResult.exitCode === 0) {
      const repoLabels = parseGhLabelNames(labelResult.stdout);
      const repoLabelLookup = createCaseInsensitiveLabelSet(repoLabels);
      const missingCanonicalLabels = requiredCanonicalLabels.filter(
        (label) => !repoLabelLookup.has(normalizeLabel(label)),
      );

      if (missingCanonicalLabels.length > 0) {
        failures.push({
          code: "missing-canonical-labels",
          title: "Required canonical triage labels are missing",
          detail: `Missing GitHub labels: ${missingCanonicalLabels.join(", ")}.`,
          remediation: SKILLS_REMEDIATION,
        });
      }

      if (!repoLabelLookup.has(normalizeLabel(SANDCASTLE_LABEL))) {
        failures.push({
          code: "missing-sandcastle-label",
          title: "The Sandcastle GitHub label is missing",
          detail: "Missing exact GitHub label: Sandcastle.",
          remediation: SANDCASTLE_LABEL_REMEDIATION,
        });
      }
    }
  }

  return failures.length === 0 ? { ok: true } : { ok: false, failures };
}

async function runCommand(
  processRunner: ProcessRunner,
  command: string,
  args: string[],
  cwd: string,
): Promise<ProcessResult> {
  try {
    return await processRunner.run(command, args, { cwd });
  } catch (error) {
    return {
      exitCode: 127,
      stdout: "",
      stderr: error instanceof Error ? error.message : String(error),
    };
  }
}

function isGitHubRemote(remoteUrl: string): boolean {
  return /^git@github\.com[:/]/i.test(remoteUrl) || /^https:\/\/github\.com\//i.test(remoteUrl);
}

function parseGhLabelNames(stdout: string): string[] {
  const parsed: unknown = JSON.parse(stdout);
  if (!Array.isArray(parsed)) {
    throw new Error("Expected gh label list to return an array.");
  }

  return parsed.flatMap((label: unknown) => (hasStringName(label) ? [label.name] : []));
}

function createCaseInsensitiveLabelSet(labels: string[]): Set<string> {
  return new Set(labels.map((label) => normalizeLabel(label)));
}

function normalizeLabel(label: string): string {
  return label.toLowerCase();
}

function hasStringName(value: unknown): value is { name: string } {
  return typeof value === "object" && value !== null && "name" in value && typeof value.name === "string";
}

const nodeFileSystem: FileSystemAdapter = {
  async exists(path) {
    try {
      await stat(path);
      return true;
    } catch {
      return false;
    }
  },
  async isDirectory(path) {
    try {
      return (await stat(path)).isDirectory();
    } catch {
      return false;
    }
  },
  async readFile(path) {
    return readFile(path, "utf8");
  },
};

const bunProcessRunner: ProcessRunner = {
  async run(command, args, options) {
    const proc = Bun.spawn([command, ...args], {
      cwd: options.cwd,
      stderr: "pipe",
      stdout: "pipe",
    });

    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);

    return { exitCode, stdout, stderr };
  },
};
