# Watchtower Initial Phase

## Summary

Watchtower's initial phase is a Bun/OpenTUI terminal app for managing which GitHub issues are ready for Sandcastle. It does not run Sandcastle yet; it prepares and reviews issue eligibility by managing GitHub labels in a repo that is already configured for Matt Pocock's skills workflow and Sandcastle.

## Preconditions

Watchtower blocks startup and shows setup instructions unless all required setup is present:

- The current working directory is a git repo.
- The repo has an `origin` remote that points at GitHub.
- The `gh` CLI is installed and authenticated.
- `docs/agents/triage-labels.md` exists and can be read.
- Required GitHub labels exist: the configured canonical triage labels plus `Sandcastle`.
- `.sandcastle/` exists in the repo.

If skills setup, `docs/agents/triage-labels.md`, or canonical triage labels are missing, instruct the user to run `/setup-matt-pocock-skills` for this repo and restart Watchtower. Watchtower does not invoke slash-command skills itself.

If the `Sandcastle` label is missing, instruct the user to complete Sandcastle label setup for this repo. If `.sandcastle/` is also missing, instruct them to run `sandcastle init`; otherwise instruct them to create the exact `Sandcastle` GitHub label and restart Watchtower.

If `.sandcastle/` is missing, instruct the user to run `sandcastle init` outside Watchtower and restart.

The preflight screen shows all detected failures, not just the first one. It stays open until the user retries after fixing setup externally or exits Watchtower.

## Definitions

- Canonical triage role: one of `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, or `wontfix`.
- Canonical triage label: the GitHub label string mapped from a canonical triage role.
- `Sandcastle` label: the fixed GitHub label string that marks an issue ready to run in Sandcastle.
- Eligible issue: any GitHub issue with the `Sandcastle` label, regardless of triage state.
- Inbox: an open, non-Sandcastle issue with no canonical triage label.
- Conflicted issue: an open, non-Sandcastle issue with more than one canonical triage label.
- Ready-to-run lane: open eligible issues.
- Closed run lane: closed eligible issues.

## Required Labels

Watchtower reads triage label strings from `docs/agents/triage-labels.md`.

That file must contain a Markdown table with these columns:

- `Label in mattpocock/skills`
- `Label in our tracker`

Watchtower requires mappings for these canonical triage roles:

- `needs-triage`
- `needs-info`
- `ready-for-agent`
- `ready-for-human`
- `wontfix`

The `Label in mattpocock/skills` column identifies canonical role names and must contain the exact role strings listed above. The `Label in our tracker` column contains the actual GitHub label strings used in this repo.

Watchtower blocks preflight with a parse failure if the table is missing, a canonical role is missing, a canonical role appears more than once, or a tracker label cell is blank.

The configured tracker label strings are used for display and GitHub mutations. Label matching against GitHub is case-insensitive, but mutations use the configured spelling from the table.

The ready-to-run label is exactly `Sandcastle` in phase one and is not configurable.

If any required canonical triage label is missing, Watchtower blocks startup and tells the user to run `/setup-matt-pocock-skills` for the repo, then restart Watchtower. If the `Sandcastle` label is missing, Watchtower blocks startup and tells the user to complete Sandcastle label setup or create the exact `Sandcastle` GitHub label.

## Queries And Bounds

Watchtower loads bounded issue sets, sorted by most recently updated first:

- Latest 100 open issues without the `Sandcastle` label for the triage screen.
- Latest 100 open issues with the `Sandcastle` label for the ready-to-run lane.
- Latest 100 closed issues with the `Sandcastle` label for the closed run lane.

Each bounded issue set applies its filters before applying the 100-item limit. The GitHub gateway may use GitHub search, `gh` flags, over-fetching, or local filtering internally, but it must preserve the set semantics: return up to 100 matching issues, not load 100 broader issues and then filter down to a smaller accidental subset.

Closed non-Sandcastle issues are intentionally invisible in phase one.

Pull requests are excluded. Archived, locked, private, and permission-restricted issue behavior is delegated to GitHub and `gh`; if `gh` cannot read or mutate an issue because of network or permission failure, Watchtower surfaces the failure and refreshes from GitHub where possible.

## Screens

### Triage Screen

The triage screen shows open GitHub issues that do not have the `Sandcastle` label.

Issues are grouped into lanes:

- `Inbox`: open issues with no canonical triage label.
- `needs-triage`
- `needs-info`
- `ready-for-human`
- `ready-for-agent`
- `wontfix`
- `Conflicted`: open issues with more than one canonical triage label.

Cards are ordered by most recently updated first within each lane.

The `wontfix` lane can contain open issues already labeled `wontfix`, meaning they are marked rejected but not yet closed. The UI action for moving into this lane should be named `Close as wontfix`: Watchtower confirms, applies the `wontfix` label, closes the issue, refreshes, and the card disappears from the triage screen.

### Run Screen

The run screen shows GitHub issues with the `Sandcastle` label.

It has two lanes:

- `Ready to run`: open issues with the `Sandcastle` label.
- `Closed`: closed issues with the `Sandcastle` label.

The run screen does not start Sandcastle in phase one.

## Card Content

Each card shows:

- Issue number.
- Workflow labels only: canonical triage labels and `Sandcastle`.
- Title.
- Plain-text body preview, capped to a small number of lines with a truncation indicator.
- Last updated age.

Cards do not show assignees in phase one.

## Actions

### Triage Moves

Users can move cards between triage lanes with keyboard-first board controls.

A triage move:

- Removes existing canonical triage labels.
- Applies the destination canonical triage label, unless moving to `Inbox`.
- Preserves non-triage labels.
- Does not edit the issue body, comments, assignees, milestones, or project fields.

Moving to `Inbox` removes canonical triage labels and keeps the issue open.

The `Close as wontfix` action requires confirmation, applies the `wontfix` label, closes the issue, and does not add a closing comment.

Moving a conflicted issue to any canonical triage lane removes all existing canonical triage labels and applies the destination label. Moving a conflicted issue to Inbox removes all canonical triage labels.

### Mark Ready To Run

Users can mark any open non-Sandcastle issue ready to run.

This action:

- Applies the `Sandcastle` label.
- Preserves the issue's current triage label.
- Moves the issue from the triage screen to the run screen.
- Requires confirmation if the issue is not currently in `ready-for-agent`.

If the issue is conflicted, Watchtower requires confirmation before promotion because promotion preserves the conflict and moves the issue to the run screen. If an issue is both conflicted and not `ready-for-agent`, show one combined confirmation explaining both risks.

### Unmark Ready To Run

Users can unmark open issues on the run screen.

This action:

- Removes the `Sandcastle` label.
- Preserves the issue's current triage label.
- Returns the issue to the triage screen.

Closed run-screen issues cannot be unmarked in phase one.

### Other Actions

Users can:

- Search loaded cards by issue number, title, workflow labels, and body preview.
- Refresh manually.
- Open the selected issue in GitHub.

Watchtower also refreshes after successful GitHub mutations.

Opening an issue in GitHub should attempt to open the browser. Watchtower shows the issue URL in the UI when no opener is available, when SSH/tmux/headless conditions are detected, or when the browser-open command exits nonzero.

## Mutation Failure Behavior

Board actions are planned as ordered GitHub mutation steps.

The executor runs mutation steps sequentially. If a step fails:

- Stop remaining steps.
- Show which step failed.
- Show that earlier steps may have succeeded.
- Do not attempt automatic rollback in phase one.
- Refresh from GitHub where possible.
- Resolve pending UI state to the refreshed GitHub state.

## Input Actions

UI components consume semantic actions, not raw terminal input events. Raw key, mouse, or terminal events map onto actions through a replaceable mapping layer, so custom keybindings and input templates can be added later. Mouse handling is not required in phase one; mouse events may map to no actions.

Phase one requires semantic actions for:

- Switch to triage screen.
- Switch to run screen.
- Move selection between cards and lanes.
- Open move menu.
- Mark ready to run.
- Unmark ready to run.
- Refresh.
- Focus search.
- Clear search.
- Open selected issue in GitHub.
- Confirm destructive action.
- Cancel modal or pending action.
- Retry preflight.
- Exit.

Exact keybindings do not need to be locked in the PRD.

## Empty States

Watchtower should show explicit empty states for:

- No triage issues.
- No ready-to-run issues.
- No closed run issues.
- No search results.
- Preflight failures.

Empty states should distinguish between genuinely empty GitHub state and the current search filter hiding all cards.

## Data And Integration

GitHub is the source of truth. Watchtower keeps only in-memory UI state in phase one.

GitHub operations use the `gh` CLI behind an internal adapter. The production adapter shells out to `gh`; tests and development can use a fixture-backed fake adapter.

Watchtower reads canonical triage label names from `docs/agents/triage-labels.md`. The ready-to-run label is hardcoded to `Sandcastle` in phase one.

## Technical Shape

- Runtime: Bun.
- Language: TypeScript.
- TUI: OpenTUI with React bindings.
- Tests: `bun test`.
- Persistence: none.
- Development invocation: `bun run dev`.
- CLI shape: a `watchtower` bin should exist for linked or installed usage.

Core logic should be testable without OpenTUI:

- Preflight checks.
- Label vocabulary parsing.
- Issue classification into screens and lanes.
- Triage move planning.
- Ready-to-run and unmark action planning.
- `Close as wontfix` planning.

## Explicit Non-Goals

Phase one does not:

- Run Sandcastle.
- Start, supervise, review, merge, or close Sandcastle run sessions.
- Create GitHub labels.
- Invoke slash-command skills.
- Run `sandcastle init`.
- Edit issue bodies or comments.
- Manage assignees, milestones, projects, or GitHub Projects fields.
- Persist local state or cache issue data between app runs.
- Support multiple repositories.
- Support configurable ready-to-run labels.
- Implement mouse drag/drop as a requirement.

## Acceptance Criteria

- `bun run dev` launches Watchtower in the current repo.
- A linked or installed package exposes a `watchtower` bin.
- Startup blocks on missing git repo, missing GitHub `origin`, missing or unauthenticated `gh`, missing skills setup, missing required canonical triage labels, missing `Sandcastle` label, or missing `.sandcastle/`.
- The preflight screen shows all detected failures with remediation and supports retry and exit.
- The triage screen shows the latest 100 open non-Sandcastle issues, grouped into Inbox, canonical triage lanes, and Conflicted.
- The run screen shows the latest 100 open Sandcastle issues in Ready to run and the latest 100 closed Sandcastle issues in Closed.
- Triage moves preserve non-triage labels and ensure one canonical triage label, except Inbox which removes all canonical triage labels.
- `Close as wontfix` moves require confirmation, apply `wontfix`, close the issue, add no comment, and refresh the board.
- Promotion applies `Sandcastle`, preserves triage state, requires confirmation outside `ready-for-agent`, and requires confirmation from Conflicted.
- Demotion removes `Sandcastle` from open run-screen issues and returns them to triage.
- Mutation failures stop remaining steps, report partial success risk, skip rollback, and refresh from GitHub where possible.
- Search filters loaded cards by issue number, title, workflow labels, and body preview.
- Empty states render for empty lanes, empty screens, preflight failures, and search-hidden results.
- Opening the selected issue attempts to open GitHub in the browser and shows the issue URL as a fallback.
- `bun test` covers preflight, label parsing, issue classification, action planning, search/filtering, body preview formatting, and GitHub command construction using fakes.
