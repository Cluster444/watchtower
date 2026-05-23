# composer review for prd-react-kanban-ui.md

- Model: `composer-2.5`
- PRD: `/home/cc444/code/watchtower/watchtower/.review/prd-react-kanban-ui.md`

# PRD Review

## Verdict

**Needs minor clarification**

The PRD is well-structured, aligned with `docs/ui-design.md` and `docs/initial-phase.md`, and mostly actionable. It already covers migration mechanics (`BoardCursor`, module map, dependencies, acceptance criteria, command table, and explicit removal of skip-empty-column behavior). Remaining gaps are mostly behavioral edge cases, a few unstated breaking changes from the current prototype, and places where an agent could implement the wrong UI shell or state contract without contradicting the PRD text.

## Top Concerns

1. **Cursor migration vs current code is specified, but “breaking changes from prototype” are not collected** — An agent can miss that triage column order, horizontal movement, per-column slot memory, and empty-column slot semantics all differ from `boardState.ts` / `boardState.test.ts` today.
2. **Initial cursor and screen-switch reset are undefined** — “Initial position” is not spelled out (`columnIndex`, `slotIndex`, empty vs populated first column).
3. **Modal input blocking is required in Implementation Decisions but absent from Acceptance Criteria** — Today `h/j/k/l` still move selection during search; the PRD requires blocking board navigation in search, move menu, and confirmation modes.
4. **Preflight and not-yet-loaded board UI are unspecified** — Whether failed preflight / loading uses the four-bar shell or stays a separate view is left open.
5. **StatusBar data source and “loading” are vague** — No model for what “loading” means beyond ad hoc status strings in `shell.ts` / `boardState.ts`.
6. **Global “all triage empty” behavior change is implicit** — Kanban “every column visible” conflicts with today’s collapsed `renderIssueBoardLines` output (`["Triage (0)", "No triage issues."]`).
7. **55 user stories create verification noise** — High overlap with acceptance criteria; an agent may over-index on stories vs the checklist.

## Specific Findings

### 1. Triage column order is intentional but easy to miss in code updates
- **Severity:** High
- **PRD section:** Implementation Decisions — “Triage columns render left to right… ready-for-human, ready-for-agent…”
- **Why it matters:** Current `TRIAGE_LANE_KEYS` in `boardState.ts` and `CANONICAL_TRIAGE_ROLES` in `issueBoard.ts` use **ready-for-agent before ready-for-human**. `boardState.test.ts` expects `moveSelectionRight` to land on `ready-for-agent`. An agent may “fix” tests back to old order or only change rendering, not navigation order.
- **Suggested fix:** Add a **Breaking changes from prototype** bullet: “Triage board column order is Inbox → … → ready-for-human → ready-for-agent → wontfix → Conflicted. Update `boardState` lane order, issue-to-kanban adapter order, and tests; do not preserve `CANONICAL_TRIAGE_ROLES` iteration order for UI layout.”

### 2. Horizontal move must restore per-column slot memory, not reset to slot 0
- **Severity:** High
- **PRD section:** User Stories 22; Implementation Decisions — “Make horizontal movement change only `columnIndex`”
- **Why it matters:** Current `moveSelection` sets `cardIndex` to `0` whenever `laneDelta !== 0`. That violates story 22 and the cursor model.
- **Suggested fix:** Explicitly: “On `moveSelectionLeft`/`Right`, update only `columnIndex` and read `slotIndexByColumn[targetColumn]` (or `undefined` if the target column has no slots). Never reset slot index to 0 on horizontal move.”

### 3. Empty focused column must use `undefined` slot index, not clamped `0`
- **Severity:** High
- **PRD section:** `BoardCursor` definition; User Stories 21, 26
- **Why it matters:** Current `normalizeSelection` clamps `cardIndex` to `0` even when a lane has zero cards, which blurs “no selected issue” vs “first slot.”
- **Suggested fix:** “For columns with zero visible slots, `slotIndexByColumn[i]` MUST be `undefined`. `getSelectedCard` / derived selection helpers return `undefined` in that case.”

### 4. Initial cursor and screen-switch reset are unspecified
- **Severity:** Medium
- **PRD section:** “Switching screens resets the destination screen cursor to its initial position”
- **Why it matters:** Agents may default to `{ columnIndex: 0, slotIndexByColumn: { 0: 0 } }`, auto-selecting the first card when the first column is populated, or leaving stale indexes from another screen shape.
- **Suggested fix:** Define canonical initial cursor per screen, e.g. `{ columnIndex: 0, slotIndexByColumn: {} }`, then normalize: if column 0 has slots, set slot `0`; if empty, leave `undefined`.

### 5. Modal modes must block board navigation — not testable from acceptance criteria alone
- **Severity:** Medium
- **PRD section:** Implementation Decisions — “While search, move menu, or confirmation mode is active, normal board navigation keys do not move the board cursor”
- **Why it matters:** Not listed in Acceptance Criteria; current shell does not guard `moveSelection*` during `searchFocused`, `moveMenuOpen`, or pending confirmations.
- **Suggested fix:** Add acceptance checkboxes: “`h/j/k/l` do not change cursor while search is focused, move menu is open, or a confirmation prompt is pending.”

### 6. Preflight UI layout is out of scope implicitly but not stated
- **Severity:** Medium
- **PRD section:** User Story 39; Acceptance — “preflight behavior are preserved”
- **Why it matters:** Today preflight uses `createPreflightFailureView`, not Header/Board/CommandBar/StatusBar. An agent might rebuild preflight as a full kanban shell or strip retry/exit hints.
- **Suggested fix:** “Failed preflight keeps the dedicated preflight failure view (not the kanban shell). Preserve retry (`refresh`/`retryPreflight`) and exit behavior.”

### 7. Board-not-loaded state is unspecified
- **Severity:** Medium
- **PRD section:** Shell layout acceptance criteria
- **Why it matters:** Current UI shows “Issue board has not loaded yet” mixed into board area. PRD does not say what CommandBar/StatusBar show before `boardState` exists.
- **Suggested fix:** “Before first successful load: Header + StatusBar only (or full shell with empty Board); CommandBar shows refresh/exit; no issue commands.”

### 8. Global empty triage screen behavior changes
- **Severity:** Medium
- **PRD section:** User Stories 3–4; Acceptance — “Every column remains visible when empty”
- **Why it matters:** `renderIssueBoardLines` collapses to a single screen-level empty message when all triage lanes are empty. Kanban UI should still show seven columns with per-column empty states.
- **Suggested fix:** “When all triage issues are absent, render all triage columns with their lane `emptyState` text; do not collapse to a single ‘Triage (0)’ banner.”

### 9. StatusBar fields vs dual status strings
- **Severity:** Medium
- **PRD section:** Acceptance — “StatusBar shows… loading state, latest mutation result, and latest error/status message”
- **Why it matters:** `WatchtowerShellState.status` and `BoardState.status` are synced in `syncShellWithBoardState`, but in-flight mutations sometimes set shell status before board sync. An agent may duplicate or drop messages.
- **Suggested fix:** “StatusBar reads from `WatchtowerShellState` after `syncShellWithBoardState`. Mutation-in-progress strings may overwrite status until refresh completes.”

### 10. “Loading state” has no concrete signal
- **Severity:** Medium
- **PRD section:** User Story 16; StatusBar acceptance
- **Why it matters:** There is no `loading: boolean`; behavior is inferred from strings like “Refresh requested” / “Unmarking…”. Agents may invent new state or omit loading UX.
- **Suggested fix:** Either define derived loading (`boardState === undefined` OR status matches in-progress prefixes) or add an explicit `isLoading` flag in shell state.

### 11. Command availability table omits keybinding strings
- **Severity:** Low
- **PRD section:** Command Availability table vs `docs/ui-design.md` examples
- **Why it matters:** Table lists commands but not keys (`m`, `p`, `u`, `Ctrl+R`). Agent may invent bindings or drift from `src/input/actions.ts`.
- **Suggested fix:** “CommandBar hint strings MUST match `docs/ui-design.md` examples and existing `WatchtowerAction` key map in `src/input/actions.ts`.”

### 12. Arrow keys and terminal sequences not mentioned
- **Severity:** Low
- **PRD section:** User Stories 18–19 (only `h/j/k/l`)
- **Why it matters:** `actions.ts` maps arrow keys and `\x1b[A` etc. to the same `moveSelection*` actions. Silent removal would be a regression.
- **Suggested fix:** “Arrow keys and existing terminal arrow sequences remain aliases for board navigation.”

### 13. Multi-line card layout has no acceptance shape
- **Severity:** Low
- **PRD section:** User Story 5; “simple compact multi-line content”
- **Why it matters:** Agents may render one Text per field, wrap unpredictably, or change truncation without tests (React snapshots forbidden).
- **Suggested fix:** “IssueCard renders at minimum: `#<number>`, workflow labels, title, body preview (existing truncation), updated age — each on its own line inside the slot.”

### 14. Fate of `renderIssueBoardLines` is unclear
- **Severity:** Low
- **PRD section:** “Replace the current line-based renderer”; Testing Decisions
- **Why it matters:** `issueBoard.test.ts` still tests line rendering. Agent may delete tests, keep dead code, or maintain two render paths.
- **Suggested fix:** “Remove `renderIssueBoardLines` from the active UI path. Replace its tests with issue-to-kanban adapter tests; delete the function if unused.”

### 15. `slotIndexByColumn` keyed by column index is fragile but accepted — document screen switch
- **Severity:** Low
- **PRD section:** `BoardCursor` type; Out of scope — “Persisting cursor position across screen switches”
- **Why it matters:** Triage (7 columns) vs run (2 columns) makes index-keyed memory meaningless across screens; PRD says reset on switch, which is enough, but agents might try to preserve indexes.
- **Suggested fix:** “On `switchScreen`, replace cursor with that screen’s initial cursor; do not carry `slotIndexByColumn` entries from the other screen.”

### 16. Closed-run command gating depends on lane, not card fields
- **Severity:** Low
- **PRD section:** Command Availability — “Run closed issue selected”
- **Why it matters:** `IssueCard` has no closed flag; eligibility is `selection.laneKey === "closed"` today. Adapter/command model must pass column/lane context, not infer from card content.
- **Suggested fix:** “Command availability for run screen uses focused column key (`readyToRun` vs `closed`), not card metadata.”

### 17. User story count vs acceptance criteria overlap
- **Severity:** Low
- **PRD section:** User Stories 1–55
- **Why it matters:** Increases token load and encourages story-by-story implementation over the acceptance checklist.
- **Suggested fix:** Collapse maintainer/future-contributor stories into a short “Architecture constraints” section; keep user-facing stories ≤20.

### 18. No file path for `WatchtowerApp` / React entry
- **Severity:** Low
- **PRD section:** `<WatchtowerApp state={state} onAction={onAction} />`
- **Why it matters:** Module map lists `kanban/`, `layout/`, `issues/` but not `src/components/WatchtowerApp.tsx` or `src/cli/shell.tsx` mount point.
- **Suggested fix:** “Add `src/components/WatchtowerApp.tsx` (shell composition). Mount from `src/cli/shell.ts` via OpenTUI React renderer; remove imperative `createWatchtowerShellView` Box/Text tree.”

### 19. Long columns without scroll — overflow behavior unspecified
- **Severity:** Low
- **PRD section:** Out of scope — “Per-column scroll viewports”
- **Why it matters:** With many cards, columns may clip or blow layout. `ui-design.md` says columns fill height and scrolling is deferred.
- **Suggested fix:** “If vertical overflow occurs, clip within column bounds; do not implement scrolling in this iteration.”

### 20. Normative doc conflict on triage order is resolved in PRD but not cross-linked
- **Severity:** Low
- **PRD section:** Required References — `docs/initial-phase.md`
- **Why it matters:** `initial-phase.md` lists ready-for-human before ready-for-agent (matches PRD). Code does not. PRD says “intentional UI order” but does not say “supersedes current code order.”
- **Suggested fix:** One line: “Column order follows `docs/initial-phase.md` triage screen list, not current `boardState`/`CANONICAL_TRIAGE_ROLES` order.”

## Agent Tripwires

| Risk | Likely mistake |
|------|----------------|
| **“Migrate to React”** | Stay on `@opentui/core` imperative `Box`/`Text`, or nest imperative nodes inside React without replacing `renderer.root.add(createWatchtowerShellView(...))`. |
| **“Replace selection with cursor”** | Keep both `selection` and `cursor`, or rename actions to `moveCursor*` despite “out of scope.” |
| **“Visual cursor only”** | Still skip empty columns because old tests pass. |
| **“Move into CommandBar”** | Move search keystroke handling or reducers into `CommandBar` React components, violating the action boundary. |
| **“Manifest actions” (story 45)** | Put `reduceBoardState`, GitHub refresh, or mutation planning inside React components. |
| **“Generic kanban”** | Import triage labels or `IssueBoard` types inside `src/components/kanban/`. |
| **“Controlled Board”** | Let `Board` own internal cursor state or emit cursor events instead of parent reducer owning `BoardCursor`. |
| **“Command availability model”** | Over-build a rules engine instead of a small pure function keyed by shell mode + cursor + lane. |
| **“Preserve behavior”** | Treat `renderIssueBoardLines` and global triage empty collapse as preserved behavior. |
| **“No React tests”** | Add snapshot tests anyway, or skip pure-module tests for cursor/adapter/command model. |
| **Column order change** | Update only React adapter visuals, not `moveSelection` lane key order / tests. |
| **Horizontal navigation** | Reset slot to `0` on column change (current behavior). |
| **Modal blocking** | Forget to guard `moveSelection*` in `reduceShellState` / input handler when search or prompts are active. |
| **StatusBar** | Show command hints in StatusBar or duplicate static key line below the board (explicitly forbidden). |
| **Dependencies** | Install React without wiring `tsconfig` / entry — though `jsx: "react-jsx"` is already set. |

## Suggested PRD Edits

Paste-ready bullets and sentences:

**New subsection: Breaking changes from prototype**
- Triage columns render in this order: Inbox, needs-triage, needs-info, **ready-for-human**, **ready-for-agent**, wontfix, Conflicted (matches `docs/initial-phase.md`, not current code).
- Remove skip-empty-column behavior in board navigation.
- Horizontal moves change only `columnIndex` and restore `slotIndexByColumn[target]`; never reset slot index to 0.
- Empty columns use `slotIndex === undefined`; no selected issue; hide issue-specific CommandBar commands.
- When all triage lanes are empty, still render every column with per-lane `emptyState` (no single “Triage (0)” collapse).

**BoardCursor / state migration (tighten existing text)**
- Replace `BoardState.selection: BoardSelection` with `BoardState.cursor: BoardCursor`.
- Add `getSelectedCard(state)` (or `getSelectedSlot`) derived from `cursor` + visible kanban columns; keep mutation helpers’ external behavior.
- On `switchScreen`, reset cursor to that screen’s initial cursor; discard indexes from the other screen.
- Initial cursor after `createBoardState` / screen switch: `columnIndex: 0`; normalize slot to `0` if column 0 has visible slots, else `undefined`.

**Acceptance criteria additions**
- [ ] `h/j/k/l` (and arrow-key aliases) do not move the cursor while search is focused, the move menu is open, or a confirmation prompt is pending.
- [ ] Failed preflight uses the dedicated preflight view, not the kanban shell; retry and exit still work.
- [ ] Before the issue board loads, the UI does not offer issue mutation commands.
- [ ] When every triage column is empty, all triage columns remain visible with per-column empty states.

**Implementation Decisions additions**
- Mount `WatchtowerApp` from `src/cli/shell.ts` via `@opentui/react`; remove `createWatchtowerShellView` and imperative board text rendering.
- Delete or stop using `renderIssueBoardLines` in the live UI; cover column order and empty/filtered states via issue-to-kanban adapter tests.
- CommandBar hint text follows `docs/ui-design.md` examples and `src/input/actions.ts` bindings.
- Run closed issues: command availability is determined by focused run column (`closed`), not card fields.
- Long columns may clip; per-column scrolling remains out of scope.

**Preflight / loading (one paragraph)**
- Setup preflight failures keep today’s standalone failure view. The Header/Board/CommandBar/StatusBar shell applies only after preflight passes and the app is in the main workflow.

**User stories (optional trim)**
- Replace stories 40–55 with a short **Architecture constraints** list (module map, action boundary, no React context, no snapshots, test pure modules only).
