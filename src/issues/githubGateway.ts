import { SANDCASTLE_LABEL, type GitHubIssue, type IssueSets } from "./issueBoard";
import type { ProcessResult, ProcessRunner } from "../setup/preflight";

export type { ProcessRunner, ProcessResult };

export type GhIssueGatewayOptions = {
  cwd?: string;
  process?: ProcessRunner;
};

const ISSUE_JSON_FIELDS = "number,title,body,labels,state,updatedAt";
const ISSUE_LIMIT = "100";

export class GhIssueGateway {
  private readonly cwd: string;
  private readonly process: ProcessRunner;

  constructor(options: GhIssueGatewayOptions = {}) {
    this.cwd = options.cwd ?? process.cwd();
    this.process = options.process ?? bunProcessRunner;
  }

  async loadIssueSets(): Promise<IssueSets> {
    const repository = await this.getRepositoryNameWithOwner();
    const [triageIssues, readyToRunIssues, closedRunIssues] = await Promise.all([
      this.searchIssues(repository, "open", [`-label:${SANDCASTLE_LABEL}`]),
      this.searchIssues(repository, "open", [`label:${SANDCASTLE_LABEL}`]),
      this.searchIssues(repository, "closed", [`label:${SANDCASTLE_LABEL}`]),
    ]);

    return { closedRunIssues, readyToRunIssues, triageIssues };
  }

  async getRepositoryUrl(): Promise<string | undefined> {
    const result = await this.process.run("gh", ["repo", "view", "--json", "url", "--jq", ".url"], {
      cwd: this.cwd,
    });
    if (result.exitCode !== 0) {
      return undefined;
    }

    return result.stdout.trim() || undefined;
  }

  async getRepositoryNameWithOwner(): Promise<string> {
    const result = await this.process.run("gh", ["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"], {
      cwd: this.cwd,
    });
    if (result.exitCode !== 0) {
      throw new Error(`gh repo view failed: ${result.stderr || result.stdout}`.trim());
    }

    const repository = result.stdout.trim();
    if (repository.length === 0) {
      throw new Error("gh repo view returned an empty repository name.");
    }

    return repository;
  }

  async addLabel(issueNumber: number, label: string): Promise<void> {
    await this.runIssueMutation(["issue", "edit", String(issueNumber), "--add-label", label], "add label");
  }

  async removeLabel(issueNumber: number, label: string): Promise<void> {
    await this.runIssueMutation(["issue", "edit", String(issueNumber), "--remove-label", label], "remove label");
  }

  async closeIssue(issueNumber: number): Promise<void> {
    await this.runIssueMutation(["issue", "close", String(issueNumber)], "close issue");
  }

  private async searchIssues(repository: string, state: "open" | "closed", qualifiers: string[]): Promise<GitHubIssue[]> {
    const result = await this.process.run("gh", createIssueSearchArgs(repository, state, qualifiers), {
      cwd: this.cwd,
    });
    if (result.exitCode !== 0) {
      throw new Error(`gh search issues failed: ${result.stderr || result.stdout}`.trim());
    }

    return parseGhIssues(result.stdout);
  }

  private async runIssueMutation(args: string[], action: string): Promise<void> {
    const result = await this.process.run("gh", args, {
      cwd: this.cwd,
    });
    if (result.exitCode !== 0) {
      throw new Error(`gh ${action} failed: ${result.stderr || result.stdout}`.trim());
    }
  }
}

function createIssueSearchArgs(repository: string, state: "open" | "closed", qualifiers: string[]): string[] {
  return [
    "search",
    "issues",
    "--repo",
    repository,
    "--state",
    state,
    "--limit",
    ISSUE_LIMIT,
    "--sort",
    "updated",
    "--order",
    "desc",
    "--json",
    ISSUE_JSON_FIELDS,
    "--",
    "is:issue",
    "no:pr",
    ...qualifiers,
  ];
}

function parseGhIssues(stdout: string): GitHubIssue[] {
  const parsed: unknown = JSON.parse(stdout);
  if (!Array.isArray(parsed)) {
    throw new Error("Expected gh search issues to return an array.");
  }

  return parsed.map((issue) => normalizeGhIssue(issue));
}

function normalizeGhIssue(value: unknown): GitHubIssue {
  const issue = readIssueObject(value);

  return {
    body: typeof issue.body === "string" ? issue.body : "",
    labels: readIssueLabels(issue.labels),
    number: readNumber(issue.number, "number"),
    state: readIssueState(issue.state),
    title: readString(issue.title, "title"),
    updatedAt: readString(issue.updatedAt, "updatedAt"),
  };
}

function readIssueObject(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null) {
    throw new Error("Expected gh issue entry to be an object.");
  }

  return value as Record<string, unknown>;
}

function readIssueLabels(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap(readIssueLabel);
}

function readIssueLabel(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }

  if (hasStringName(value)) {
    return [value.name];
  }

  return [];
}

function readNumber(value: unknown, field: string): number {
  if (typeof value !== "number") {
    throw new Error(`Expected gh issue ${field} to be a number.`);
  }

  return value;
}

function readString(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw new Error(`Expected gh issue ${field} to be a string.`);
  }

  return value;
}

function readIssueState(value: unknown): "OPEN" | "CLOSED" {
  switch (value) {
    case "OPEN":
    case "open":
      return "OPEN";
    case "CLOSED":
    case "closed":
      return "CLOSED";
    default:
      throw new Error("Expected gh issue state to be OPEN or CLOSED.");
  }
}

function hasStringName(value: unknown): value is { name: string } {
  return typeof value === "object" && value !== null && "name" in value && typeof value.name === "string";
}

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
