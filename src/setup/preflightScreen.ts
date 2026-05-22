import type { SetupFailure } from "./preflight";

export function formatPreflightFailureLines(failures: SetupFailure[]): string[] {
  const lines = [
    "Setup blocked",
    `Watchtower found ${failures.length} setup ${failures.length === 1 ? "failure" : "failures"}.`,
  ];

  failures.forEach((failure, index) => {
    lines.push(
      `${index + 1}. ${failure.title}`,
      `   ${failure.detail}`,
      `   Fix: ${failure.remediation}`,
    );
  });

  lines.push("Press Ctrl+R to retry preflight or q to exit.");
  return lines;
}
