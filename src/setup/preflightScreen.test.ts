import { describe, expect, test } from "bun:test";
import { formatPreflightFailureLines } from "./preflightScreen";

describe("formatPreflightFailureLines", () => {
  test("shows every failure with remediation plus retry and exit actions", () => {
    expect(
      formatPreflightFailureLines([
        {
          code: "not-git-repo",
          title: "Current directory is not a git repo",
          detail: "Watchtower must run inside the target repo.",
          remediation: "Change into the target git repo, then restart Watchtower.",
        },
        {
          code: "missing-sandcastle-label",
          title: "The Sandcastle GitHub label is missing",
          detail: "Missing exact GitHub label: Sandcastle.",
          remediation:
            "Complete Sandcastle label setup or create the exact Sandcastle GitHub label, then restart Watchtower.",
        },
      ]),
    ).toEqual([
      "Setup blocked",
      "Watchtower found 2 setup failures.",
      "1. Current directory is not a git repo",
      "   Watchtower must run inside the target repo.",
      "   Fix: Change into the target git repo, then restart Watchtower.",
      "2. The Sandcastle GitHub label is missing",
      "   Missing exact GitHub label: Sandcastle.",
      "   Fix: Complete Sandcastle label setup or create the exact Sandcastle GitHub label, then restart Watchtower.",
      "Press Ctrl+R to retry preflight or q to exit.",
    ]);
  });
});
