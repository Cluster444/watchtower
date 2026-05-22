import { describe, expect, test } from "bun:test";
import { parseLabelVocabulary } from "./labelVocabulary";

const VALID_TABLE = `
| Label in mattpocock/skills | Label in our tracker |
| -------------------------- | -------------------- |
| \`needs-triage\` | Needs Triage |
| \`needs-info\` | needs-info |
| \`ready-for-agent\` | ready-for-agent |
| \`ready-for-human\` | ready-for-human |
| \`wontfix\` | wontfix |
`;

describe("parseLabelVocabulary", () => {
  test("parses the canonical triage role mappings from the markdown table", () => {
    expect(parseLabelVocabulary(VALID_TABLE)).toEqual({
      labelsByRole: {
        "needs-triage": "Needs Triage",
        "needs-info": "needs-info",
        "ready-for-agent": "ready-for-agent",
        "ready-for-human": "ready-for-human",
        wontfix: "wontfix",
      },
    });
  });

  test("fails when the required table is missing", () => {
    expect(parseLabelVocabulary("no table here")).toEqual({
      error: {
        code: "missing-table",
        message:
          "docs/agents/triage-labels.md must contain a Markdown table with Label in mattpocock/skills and Label in our tracker columns.",
      },
    });
  });

  test("fails when a role is missing, duplicated, or blank", () => {
    expect(parseLabelVocabulary(VALID_TABLE.replace("| `wontfix` | wontfix |", ""))).toEqual({
      error: {
        code: "missing-role",
        message: "docs/agents/triage-labels.md is missing canonical role: wontfix.",
      },
    });

    expect(parseLabelVocabulary(`${VALID_TABLE}| \`needs-info\` | Needs Info Duplicate |\n`)).toEqual({
      error: {
        code: "duplicate-role",
        message: "docs/agents/triage-labels.md maps canonical role more than once: needs-info.",
      },
    });

    expect(parseLabelVocabulary(VALID_TABLE.replace("| `needs-info` | needs-info |", "| `needs-info` | |"))).toEqual({
      error: {
        code: "blank-tracker-label",
        message: "docs/agents/triage-labels.md has a blank tracker label for canonical role: needs-info.",
      },
    });
  });
});
