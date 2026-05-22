import type { ProcessResult } from "../setup/preflight";

export type BrowserOpenProcess = {
  run(command: string, args: string[], options: { cwd?: string }): Promise<ProcessResult>;
};

export type BrowserOpenResult =
  | { opened: true }
  | { opened: false; fallbackUrl: string; reason: string };

type BrowserOpenOptions = {
  env?: Record<string, string | undefined>;
  platform?: NodeJS.Platform;
  process?: BrowserOpenProcess;
};

export async function openIssueInBrowser(
  url: string,
  options: BrowserOpenOptions = {},
): Promise<BrowserOpenResult> {
  const env = options.env ?? process.env;
  const platform = options.platform ?? process.platform;
  const opener = getBrowserOpenCommand(platform);

  if (opener === undefined || isHeadlessTerminal(env, platform)) {
    return fallback(url, "No browser opener is available in this terminal session.");
  }

  const runner = options.process ?? bunProcessRunner;
  const result = await runner.run(opener.command, [...opener.args, url], {});
  if (result.exitCode !== 0) {
    return fallback(url, `Browser open failed: ${(result.stderr || result.stdout || "unknown error").trim()}`);
  }

  return { opened: true };
}

function getBrowserOpenCommand(platform: NodeJS.Platform): { command: string; args: string[] } | undefined {
  switch (platform) {
    case "darwin":
      return { command: "open", args: [] };
    case "win32":
      return { command: "cmd", args: ["/c", "start", ""] };
    case "linux":
    case "freebsd":
    case "openbsd":
      return { command: "xdg-open", args: [] };
    default:
      return undefined;
  }
}

function isHeadlessTerminal(env: Record<string, string | undefined>, platform: NodeJS.Platform): boolean {
  if (platform === "darwin" || platform === "win32") {
    return false;
  }

  const hasDisplay = Boolean(env.DISPLAY || env.WAYLAND_DISPLAY);
  const remoteTerminal = Boolean(env.SSH_TTY || env.SSH_CONNECTION || env.TMUX);
  return !hasDisplay || remoteTerminal;
}

function fallback(url: string, reason: string): BrowserOpenResult {
  return { opened: false, fallbackUrl: url, reason };
}

const bunProcessRunner: BrowserOpenProcess = {
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
