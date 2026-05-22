export const CANONICAL_TRIAGE_ROLES = [
  "needs-triage",
  "needs-info",
  "ready-for-agent",
  "ready-for-human",
  "wontfix",
] as const;

export type CanonicalTriageRole = (typeof CANONICAL_TRIAGE_ROLES)[number];

export type LabelVocabulary = {
  labelsByRole: Record<CanonicalTriageRole, string>;
};

export type LabelVocabularyErrorCode =
  | "missing-table"
  | "missing-role"
  | "duplicate-role"
  | "blank-tracker-label";

export type LabelVocabularyError = {
  code: LabelVocabularyErrorCode;
  message: string;
};

export type LabelVocabularyParseResult =
  | LabelVocabulary
  | {
      error: LabelVocabularyError;
    };

const SKILLS_COLUMN = "Label in mattpocock/skills";
const TRACKER_COLUMN = "Label in our tracker";
const CANONICAL_TRIAGE_ROLE_SET: ReadonlySet<string> = new Set(CANONICAL_TRIAGE_ROLES);

export function parseLabelVocabulary(markdown: string): LabelVocabularyParseResult {
  const table = findLabelTable(markdown);
  if (table === undefined) {
    return {
      error: {
        code: "missing-table",
        message:
          "docs/agents/triage-labels.md must contain a Markdown table with Label in mattpocock/skills and Label in our tracker columns.",
      },
    };
  }

  const labelsByRole: Record<CanonicalTriageRole, string> = {
    "needs-triage": "",
    "needs-info": "",
    "ready-for-agent": "",
    "ready-for-human": "",
    wontfix: "",
  };
  const seenRoles = new Set<CanonicalTriageRole>();

  for (const row of table.rows) {
    const rawRole = stripMarkdownCode(row[table.skillsColumn] ?? "");
    if (!isCanonicalTriageRole(rawRole)) {
      continue;
    }

    if (seenRoles.has(rawRole)) {
      return {
        error: {
          code: "duplicate-role",
          message: `docs/agents/triage-labels.md maps canonical role more than once: ${rawRole}.`,
        },
      };
    }

    const trackerLabel = stripMarkdownCode(row[table.trackerColumn] ?? "");
    if (trackerLabel.length === 0) {
      return {
        error: {
          code: "blank-tracker-label",
          message: `docs/agents/triage-labels.md has a blank tracker label for canonical role: ${rawRole}.`,
        },
      };
    }

    seenRoles.add(rawRole);
    labelsByRole[rawRole] = trackerLabel;
  }

  const missingRole = CANONICAL_TRIAGE_ROLES.find((role) => !seenRoles.has(role));
  if (missingRole !== undefined) {
    return {
      error: {
        code: "missing-role",
        message: `docs/agents/triage-labels.md is missing canonical role: ${missingRole}.`,
      },
    };
  }

  return { labelsByRole };
}

function findLabelTable(markdown: string):
  | {
      skillsColumn: number;
      trackerColumn: number;
      rows: string[][];
    }
  | undefined {
  const lines = markdown.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const header = parseTableRow(lines[index] ?? "");
    if (header.length === 0) {
      continue;
    }

    const normalizedHeader = header.map((cell) => stripMarkdownCode(cell));
    const skillsColumn = normalizedHeader.indexOf(SKILLS_COLUMN);
    const trackerColumn = normalizedHeader.indexOf(TRACKER_COLUMN);
    if (skillsColumn === -1 || trackerColumn === -1) {
      continue;
    }

    const separator = lines[index + 1] ?? "";
    if (!isSeparatorRow(separator)) {
      continue;
    }

    const rows: string[][] = [];
    for (let rowIndex = index + 2; rowIndex < lines.length; rowIndex += 1) {
      const row = parseTableRow(lines[rowIndex] ?? "");
      if (row.length === 0) {
        break;
      }

      rows.push(row);
    }

    return { skillsColumn, trackerColumn, rows };
  }

  return undefined;
}

function parseTableRow(line: string): string[] {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) {
    return [];
  }

  return trimmed
    .slice(1, -1)
    .split("|")
    .map((cell) => cell.trim());
}

function isSeparatorRow(line: string): boolean {
  const cells = parseTableRow(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell.trim()));
}

function stripMarkdownCode(value: string): string {
  const trimmed = value.trim();
  return trimmed.replace(/^`+/, "").replace(/`+$/, "").trim();
}

function isCanonicalTriageRole(role: string): role is CanonicalTriageRole {
  return CANONICAL_TRIAGE_ROLE_SET.has(role);
}
