# opus review for prd-react-kanban-ui.md

- Model: `claude-opus-4-7-max`
- PRD: `/home/cc444/code/watchtower/watchtower/.review/prd-react-kanban-ui.md`

I have a complete picture. The PRD aligns closely with `docs/ui-design.md` and existing code. Now I'll produce the review.

# PRD Review

## Verdict
**Needs minor clarification.** The PRD is logically consistent, well-grounded in `docs/ui-design.md` and `docs/initial-phase.md`, and reuses the canonical `BoardCursor` shape. But it leaves an autonomous agent enough ambiguity around the selection-model migration, the `BoardCursor` data layout, dependency setup, and acceptance criteria that they will likely either overbuild or under-build the change.

## Top Concerns
1. **No acceptance criteria section.** Every other Watchtower planning doc (notably `docs/initial-phase.md`) ends in an explicit acceptance-criteria list. This PRD has User Stories + Implementation Decisions but no checkable Done definition, which is exactly what an implementation agent uses to know when to stop.
2. **`BoardCursor` is keyed by index, but `boardState.ts` currently keys selection by `laneKey: BoardLaneKey`.** The PRD says "Update existing board state tests rather than duplicating coverage when the selection model is renamed", but never says whether `BoardSelection` is replaced wholesale, kept alongside, or converted at the boundary. An agent could (a) rewrite `BoardState.selection` to use the new cursor shape and break `getSelectedCard`, `moveSelectedIssueToTriageDestination`, etc.; (b) introduce a parallel `cursor` field and leave both, doubling state; or (c) try to translate inside the reducer. The PRD must pick one.
3. **`BoardCursor` shape is underspecified for refresh/reorder.** `slotIndexByColumn: Record<number, number | undefined>` is keyed by **column index**, not column key. After a refresh that changes column counts (it won't on this screen, but it can after a screen switch from triage → run), every entry becomes meaningless. The "Open Questions" in `ui-design.md` flags exactly this ("Should cursor position preserve stable slot identity across refreshes...") but the PRD does not pick an answer.
4. **No mention of `@opentui/react` as a dependency or how to install it.** The repo currently has only `@opentui/core` and no `react`/`react-dom` deps, no `.tsx` files, and the `tsconfig.json` already has `"jsx": "react-jsx"`. The PRD says "Run TypeScript typechecking after implementation because the React migration changes JSX configuration and dependencies" but doesn't name the packages or version constraints. An agent will guess.
5. **"Empty focused column → no selected issue commands" contradicts the existing implementation of column traversal.** Today `findNextSelectableLaneIndex` *skips* empty lanes during `h`/`l`. The PRD requires empty columns to be focusable. Either the existing skip-empty behavior is being removed (acceptance: yes, per User Story 21), or it isn't. The PRD should say so explicitly and call out that `boardState.ts` lane-skip logic must be removed.
6. **Screen-switch keybindings (`1/t`, `2/r`) are present in the current `CommandBar` text but absent from the PRD's example CommandBar contents in `ui-design.md`.** The PRD does not say whether screen switching disappears from the CommandBar, moves to the Header, or remains in both. User Story 8/9 puts screen navigation in the Header — but the Header is "shows app identity and screen navigation", not "owns the keybindings for it". An agent may delete the screen-switch hints entirely.

## Specific Findings

### High severity

- **Severity: High** — No Acceptance Criteria section.
  - *Why it matters:* Agent has no checkpoint to declare the task done. User Stories are aspirational; tests + acceptance criteria are mergeable.
  - *Suggested fix:* Add an `## Acceptance Criteria` section. Suggested items at the end of this review.

- **Severity: High** — Section "Implementation Decisions", `BoardCursor` definition.
  > `slotIndexByColumn: Record<number, number | undefined>;`
  - *Why it matters:* Index keys are fragile across column-set changes. The current `BoardSelection.laneKey` (`TriageLaneKey | RunLaneKey`) is stable. The PRD says "Use stable column and slot keys for identity and rendering" but then uses indexes for the persistent map.
  - *Suggested fix:* Either (a) keep indexes but reset `slotIndexByColumn` on every screen switch and board refresh and say so, or (b) change to `slotIndexByColumnKey: Record<string, number | undefined>` and document the stable column key contract. Pick one explicitly.

- **Severity: High** — Section "Implementation Decisions" + "Testing Decisions".
  > "Update existing board state tests rather than duplicating coverage when the selection model is renamed to the board cursor model."
  - *Why it matters:* Ambiguous about whether `BoardState.selection` is replaced, supplemented, or translated. Affects `getSelectedCard`, `moveSelectedIssueToTriageDestination`, `markSelectedIssueReadyToRun`, `unmarkSelectedIssueReadyToRun`, `getSelectedIssueUrl`, and four shell-level call sites.
  - *Suggested fix:* Add one sentence: e.g. "Replace `BoardState.selection` with `BoardState.cursor: BoardCursor`. Add a derived helper `getSelectedSlot(state)` that returns `{ columnKey, card } | undefined`. Mutation entry points should keep their existing public contracts and read from the new cursor internally."

- **Severity: High** — Section "Implementation Decisions", "Keep raw input mapping to semantic actions before reducers update state".
  - *Why it matters:* The existing `WatchtowerAction` vocabulary uses `moveSelectionUp/Down/Left/Right`. The PRD says "Do not introduce a new action vocabulary for this iteration. Reuse existing semantic actions where possible." But those action names are about "selection" (a card), not "cursor" (a position). An agent may either (a) rename them to `moveCursor*`, breaking `src/input/actions.test.ts`, or (b) keep the old names and let the vocabulary lag behind the new model.
  - *Suggested fix:* State explicitly: "Keep `moveSelectionUp/Down/Left/Right` action names in this iteration; renaming is out of scope." Or: "Rename them to `moveCursor*` and update `src/input/actions.ts` + tests in the same change."

### Medium severity

- **Severity: Medium** — Section "Solution", paragraph 2.
  > "The Header shows app identity and screen navigation."
  - *Why it matters:* Doesn't say whether screen-switch keybindings (`1`/`t`/`2`/`r`) move out of CommandBar, stay in CommandBar, or appear in both. The example CommandBar lines in `ui-design.md` omit them.
  - *Suggested fix:* Add: "Screen-switch keybindings (`1`/`t` triage, `2`/`r` run) are shown in the Header next to screen labels, not in the CommandBar."

- **Severity: Medium** — Section "Implementation Decisions" + User Story 21.
  > "Allow empty columns to be focused."
  - *Why it matters:* `boardState.ts:findNextSelectableLaneIndex` currently skips empty lanes during `h`/`l`. The PRD must explicitly require this to change; otherwise an agent may keep the skip and silently violate User Story 21.
  - *Suggested fix:* Add: "Remove the skip-empty-lane behavior in `boardState.ts`. Horizontal cursor movement must land on every column whether or not it has cards."

- **Severity: Medium** — Section "Out of Scope".
  > "Fully solving independent column scrolling if OpenTUI support requires a larger spike. The component contract should still point toward per-column scrolling."
  - *Why it matters:* "Component contract should still point toward per-column scrolling" is undefined work for the agent. It will either be ignored or overbuilt into a scroll abstraction.
  - *Suggested fix:* "Each `Column` should accept its own children and own its vertical layout. Do not implement scroll viewports in this iteration." Drop the soft requirement.

- **Severity: Medium** — Section "Solution", paragraph 1.
  > "The triage screen will render columns for Inbox, canonical triage states, and Conflicted issues."
  - *Why it matters:* Doesn't specify column order. Today, lane order is `inbox, needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix, conflicted`. An agent looking only at the PRD may put Conflicted between others, or omit `wontfix`.
  - *Suggested fix:* Reference `docs/initial-phase.md#triage-screen` explicitly, or restate the column order.

- **Severity: Medium** — Section "Testing Decisions".
  > "Avoid snapshot tests for the whole terminal UI in this iteration unless OpenTUI React gives a stable test renderer."
  - *Why it matters:* No guidance on whether the agent should even attempt to render the React tree in tests, and which tests to delete vs. update. `src/cli/shell.test.ts` currently tests `reduceShellState` as pure data — that file may need rewrites once `boardState`/`cursor` shape changes.
  - *Suggested fix:* Name the files: "Update `src/issues/boardState.test.ts` and `src/cli/shell.test.ts` to use `BoardCursor`. Do not write new React component tests in this iteration."

- **Severity: Medium** — Section "Implementation Decisions".
  > "Migrate the rendering path to OpenTUI React bindings so the UI can be expressed as real React components."
  - *Why it matters:* No package name. The `@opentui/react` package isn't installed. The agent will need to (a) `bun add @opentui/react react react-dom`, (b) decide whether to keep `createCliRenderer` from `@opentui/core` and mount React on it, or replace it. The current `runWatchtowerCli` calls `createCliRenderer({ exitOnCtrlC, useMouse })` and adds raw `Box`/`Text` nodes via `renderer.root.add`.
  - *Suggested fix:* Add: "Install `@opentui/react` (latest) and React 18. Mount React via the OpenTUI React renderer entrypoint. Replace `renderer.root.add(...)` direct calls."

- **Severity: Medium** — Section "Implementation Decisions", controlled `Board`.
  > "The Board receives columns and cursor state, and renders the current cursor rather than owning application state internally."
  - *Why it matters:* Doesn't specify the props contract. An agent might invent props like `onColumnFocus`/`onSlotFocus` or it might pass only data and rely on the parent to render highlights. The two designs lead to very different code.
  - *Suggested fix:* "Board props: `{ columns: BoardColumn[]; cursor: BoardCursor }`. Board does not emit cursor change events; cursor changes are driven by the existing semantic actions in the parent shell."

### Low severity

- **Severity: Low** — Section "User Stories", US 22 ("each column to remember its own slot cursor") vs. cursor reset on screen switch.
  - *Why it matters:* If `slotIndexByColumn` is keyed by index, switching `triage` → `run` and back will not preserve per-column slot cursors (column count and identity change). Users may expect "remembered position" to survive screen switches.
  - *Suggested fix:* Add a note: "Each screen has its own cursor. Switching screens resets the cursor on the destination screen to column 0, slot 0."

- **Severity: Low** — Section "User Stories", US 26.
  > "selected issue commands to disappear or become unavailable when an empty column is focused"
  - *Why it matters:* "Disappear or become unavailable" leaves both options open. Agent may pick "grey out" vs. "remove" inconsistently. The `ui-design.md` Command Bar example for empty column already shows the commands removed.
  - *Suggested fix:* Use one verb: "Hide selected-issue commands from CommandBar when an empty column is focused." Reference the example in `ui-design.md`.

- **Severity: Low** — Section "Implementation Decisions".
  > "Build a generic kanban module with Board, Column, Slot, kanban types, and cursor helpers."
  - *Why it matters:* No file paths. `ui-design.md` says `src/components/kanban/`, `src/components/layout/`, `src/components/issues/`, but the PRD never restates this. An agent reading the PRD in isolation may invent a different layout.
  - *Suggested fix:* Restate the directory layout or explicitly reference `ui-design.md#component-boundaries` as binding.

- **Severity: Low** — Section "Implementation Decisions".
  > "Use a restrained terminal control-surface theme with a shared theme module."
  - *Why it matters:* No file path or shape. Current code has color literals inline in `shell.ts` (`#8BD5CA`, `#F9E2AF`, `#A6E3A1`, `#A6ADC8`, `#F38BA8`, `#CDD6F4`).
  - *Suggested fix:* "Add `src/components/theme.ts` exporting a single `theme` object with the named tokens listed in `ui-design.md#theme`. Replace inline color literals in shell rendering."

- **Severity: Low** — Section "Further Notes".
  > "The likely deep modules are the generic kanban cursor helpers, issue-to-kanban adapter, and contextual command model."
  - *Why it matters:* "Likely" is hedged. If these are required deep modules with tests (as Testing Decisions imply), drop the hedge.
  - *Suggested fix:* "The deep modules in this iteration are: cursor helpers (`src/components/kanban/cursor.ts`), issue-to-kanban adapter (`src/components/issues/adapter.ts`), and contextual command model (`src/components/layout/commandBar.ts`). Each has isolated tests."

- **Severity: Low** — Section "Implementation Decisions".
  > "Do not introduce a new CLI orchestration architecture. Limit shell changes to what is required to mount React and pass state/actions into React."
  - *Why it matters:* "Pass state/actions into React" is one of two things: (a) a single top-level prop blob, or (b) a context/reducer pattern. Agent will pick.
  - *Suggested fix:* "Mount a single `<WatchtowerApp state={state} dispatch={dispatch} />` component. Do not introduce React Context for shell state in this iteration."

- **Severity: Low** — "Renderer-related test isolation."
  - *Why it matters:* Tests run under `bun test`. The new React components must not be imported by pure data tests (`boardState.test.ts`, cursor helpers, adapter), or they'll fail to load in the test runner if OpenTUI requires a renderer.
  - *Suggested fix:* "Place cursor helpers, adapter, and command-bar model in files that do not import OpenTUI or React, so they remain trivially testable."

## Agent Tripwires
- **Renaming `BoardSelection`.** An agent will be tempted to delete `BoardSelection` and rewire `getSelectedCard`/`moveSelectedIssueToTriageDestination`/`markSelectedIssueReadyToRun`/`unmarkSelectedIssueReadyToRun`/`getSelectedIssueUrl` to the new cursor shape in one pass. The mutation paths key off `selection.laneKey` and `selection.cardIndex`. Without explicit guidance, this rewrite will be larger than the PRD's "small change to connect them" framing.
- **Reusing `WatchtowerAction` names.** `moveSelectionUp/Down/Left/Right` will read weirdly next to a "cursor" model. Agent may rename across `src/input/actions.ts`, `src/input/actions.test.ts`, `src/cli/shell.ts`, `src/cli/shell.test.ts` even though the PRD says "Do not introduce a new action vocabulary".
- **Removing skip-empty-lane behavior.** Agent may miss `findNextSelectableLaneIndex` in `boardState.ts` and leave empty columns unreachable.
- **Pulling search input handling into a React component.** Today, `shell.ts:isSearchTextInput` accumulates text directly into `boardState.searchQuery`. The PRD says "Move ... search input ... into CommandBar". An agent may move the *input handler* (effect) into the CommandBar component, violating "Keep data loading, setup preflight, GitHub mutation effects, and process lifecycle outside the React presentation components" (the boundary is ambiguous for keystroke routing).
- **Building a `<Column>` scroll container.** The Out-of-Scope hedge invites overbuild.
- **Snapshot or render testing.** Even with the "Avoid snapshot tests" caveat, an agent will reach for `@opentui/react/test` or similar if it exists, when none of the kanban/adapter logic needs it.
- **Re-deriving column order.** `IssueBoard.triage` is an object, not an ordered array. Agent may iterate `Object.values(board.triage)` and get an implementation-defined order.
- **Mounting React on top of existing `Box`/`Text` from `@opentui/core`.** The current renderer mixes imperative `renderer.root.add` with functional `Box(...)` calls. An agent may keep `Box(...)` calls inside React components, double-wrapping.
- **`pendingDestructiveMove` / `pendingReadyToRunPromotion`.** These shell-state flags drive the confirmation prompt in CommandBar per the new design. The PRD doesn't say how they move, only that confirmation prompts render in CommandBar. An agent may invent a new "pending action" model.
- **`docs/prd-react-kanban-ui.md` already exists outside `.review/`.** The Out-of-Scope says "Publishing this PRD to GitHub before review" is not allowed. There are now two copies (the one being reviewed at `.review/` and the existing `docs/prd-react-kanban-ui.md`). The implementation agent may treat the wrong one as canonical.

## Suggested PRD Edits

Paste-ready additions and fixes:

### Add a new section `## Acceptance Criteria`

```markdown
## Acceptance Criteria

- `bun test` and `bun run typecheck` pass after the migration.
- `@opentui/react`, `react`, and `react-dom` are installed; `bun run dev` launches Watchtower as a React-rendered terminal UI.
- The triage screen renders columns in this order: Inbox, needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix, Conflicted.
- The run screen renders columns in this order: Ready to run, Closed.
- Every column remains visible when empty and shows its empty-state text.
- `h`/`l` move the board cursor through every column (including empty ones) without mutating any GitHub issue.
- `j`/`k` move the slot cursor within the focused column only.
- Each column remembers its own slot index for the active screen; switching screens resets the cursor on the destination screen.
- The focused column is highlighted with a background lighter than the board; the focused slot has a background lighter than the focused column.
- CommandBar contents follow the examples in `docs/ui-design.md#command-and-status-bars` for triage-selected, run-open-selected, closed-run-selected, empty-column-focused, search-focused, and confirmation-prompt states.
- StatusBar shows the current screen, the selected issue summary (or "no selection" when an empty column is focused), loading state, the latest mutation result, and the latest error.
- Existing tests in `src/issues/boardState.test.ts`, `src/cli/shell.test.ts`, `src/input/actions.test.ts`, `src/issues/triageActions.test.ts`, `src/issues/issueBoard.test.ts`, and `src/setup/*.test.ts` still pass (updated for the cursor model where they reference selection).
- New tests exist for the cursor helpers, the issue-to-kanban adapter, and the CommandBar contextual command model.
- Triage moves, Close as wontfix confirmation, ready-to-run promotion confirmation, demotion behavior, and the "closed run issues cannot be unmarked" guard all behave the same way they did before the migration.
```

### Replace the `BoardCursor` block

```markdown
- Use a visual board cursor with this canonical shape:

```ts
type BoardCursor = {
  columnIndex: number;
  slotIndexByColumn: Record<number, number | undefined>;
};
```

- `slotIndexByColumn` is keyed by column index. It is reset whenever the active screen changes or the board reloads with a different column count. Stable column and slot keys are used only for rendering identity (`key` props), not for cursor persistence in this iteration.
- Replace `BoardState.selection` with `BoardState.cursor: BoardCursor`. Add a pure helper `getSelectedSlot(boardState)` that returns the focused column key and card, or `undefined` when the focused column is empty. Refactor `getSelectedCard`, `moveSelectedIssueToTriageDestination`, `markSelectedIssueReadyToRun`, `unmarkSelectedIssueReadyToRun`, and `getSelectedIssueUrl` to read from the cursor through that helper. Their public signatures do not change.
- Remove the skip-empty-lane behavior in `boardState.ts`. Horizontal cursor movement must visit every column, including empty ones.
```

### Add to `## Implementation Decisions`

```markdown
- Install `@opentui/react`, `react`, and `react-dom` as new dependencies. React 18.
- Mount a single React root through `@opentui/react`'s renderer entrypoint, replacing the current imperative `renderer.root.add(...)` calls in `src/cli/shell.ts`. Keep `createCliRenderer`'s `exitOnCtrlC: false`, `useMouse: false` configuration.
- File layout follows `docs/ui-design.md#component-boundaries`:
  - `src/components/kanban/` for `Board.tsx`, `Column.tsx`, `Slot.tsx`, `cursor.ts`, `types.ts`.
  - `src/components/layout/` for `Header.tsx`, `CommandBar.tsx`, `StatusBar.tsx`, and the pure command-bar model `commandBar.ts`.
  - `src/components/issues/` for `IssueCard.tsx` and `adapter.ts` (issue-board → kanban columns).
  - `src/components/theme.ts` for shared color tokens.
- The cursor helpers (`cursor.ts`), the adapter (`adapter.ts`), and the command-bar model (`commandBar.ts`) must not import OpenTUI or React, so their tests run as pure data.
- `Board` props are `{ columns: BoardColumn[]; cursor: BoardCursor }`. `Board` does not emit cursor-change events; cursor changes happen in the existing shell reducer.
- Pass shell state and dispatch into a single top-level component, e.g. `<WatchtowerApp state={state} dispatch={dispatch} />`. Do not introduce React Context in this iteration.
- Screen-switch keybindings (`1`/`t` triage, `2`/`r` run) render in the Header next to the screen labels, not in the CommandBar.
- Hide (do not grey out) selected-issue commands in the CommandBar when an empty column is focused.
- Keep the `WatchtowerAction` names as-is (`moveSelectionUp/Down/Left/Right`, etc.). Renaming to `moveCursor*` is out of scope.
- Keystroke routing (search text input, move-menu number keys, confirmation prompt Enter/Esc) stays in `src/cli/shell.ts`. React components consume state and dispatch semantic actions; they do not read raw input.
```

### Add to `## Out of Scope`

```markdown
- Per-column scroll viewports. Columns own their layout but do not virtualize or scroll independently in this iteration.
- Persisting cursor position across screen switches or board refreshes.
- Renaming `moveSelectionUp/Down/Left/Right` actions to `moveCursor*`.
- React Context for shell state.
- New rendering or snapshot tests for React components.
```

### Add to `## Testing Decisions`

```markdown
- Update (do not duplicate) `src/issues/boardState.test.ts` and `src/cli/shell.test.ts` for the cursor model.
- Add a new pure-data test file for cursor helpers at `src/components/kanban/cursor.test.ts`.
- Add a new pure-data test file for the issue-to-kanban adapter at `src/components/issues/adapter.test.ts`.
- Add a new pure-data test file for the CommandBar model at `src/components/layout/commandBar.test.ts`.
- Do not import OpenTUI or React in these three new test files.
```
