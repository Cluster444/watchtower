# opus review for prd-react-kanban-ui.md

- Model: `claude-opus-4-7-max`
- PRD: `/home/cc444/code/watchtower/watchtower/.review/prd-react-kanban-ui.md`

I have enough context. Let me now write the PRD review.

# PRD Review

## Verdict
**Needs minor clarification.**

The PRD is comprehensive, well-structured, internally consistent with the surrounding docs (`CONTEXT.md`, `docs/ui-design.md`, `docs/initial-phase.md`, ADR 0001), and unusually explicit about scope. It is close to ready, but there are a handful of concrete gaps and contradictions an implementation agent will hit immediately (column order mismatch with `docs/initial-phase.md`, derived-helper contract for `BoardSelection`→`BoardCursor`, search-text routing through the new input layer, OpenTUI React renderer integration details, and `bun run typecheck` validity after deps are added).

## Top Concerns

1. **Column order contradiction with `docs/initial-phase.md`.** The PRD declares the triage column order `Inbox, needs-triage, needs-info, ready-for-human, ready-for-agent, wontfix, Conflicted` but `docs/initial-phase.md` lists `Inbox, needs-triage, needs-info, ready-for-human, ready-for-agent, wontfix, Conflicted` in one place and the existing `boardState.ts` `TRIAGE_LANE_KEYS` uses `inbox, needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix, conflicted`. The PRD says this is "an intentional UI order and should be reflected in updated tests" — meaning code, doc, and tests all change. The PRD must clearly state which of the two docs is now canonical and whether `initial-phase.md` should be updated as part of this iteration.

2. **`BoardSelection` → `BoardCursor` swap is under-specified.** The PRD says "Replace `BoardSelection` with `BoardCursor` in board state" and "Add a derived helper for selected issue/card lookup from the current cursor and active board columns. Mutation entry points should keep their public behavior but read the selected issue through that helper." But it does not name the helper, does not say where it lives (kanban adapter vs. `boardState.ts`), and does not specify whether `boardState.ts` still owns `selection`-shaped state at all or pivots fully to a cursor. The existing `BoardSelection` exposes `{ screen, laneKey, cardIndex }` and is read by `getSelectedCard`, `getSelectedIssueUrl`, all three mutation functions, and shell rendering. An agent could easily either (a) keep `BoardSelection` and bolt a cursor on top, or (b) rip out `BoardSelection` and break public exports, depending on interpretation.

3. **Text input routing is contradicted across sections.** The Implementation Decisions section says "Keystroke routing stays high in the application/shell layer for this iteration. Search text input, move-menu number keys, confirmation Enter/Esc handling, and component focus routing should not move into leaf React components." Good. But the Command Availability table includes the row `Search focused | Current search query, type to filter, Backspace clear, Esc cancel`, and one of the user stories (#12) says "I want the CommandBar to show search input while search is focused." An agent will reasonably wonder whether CommandBar takes over keystroke capture for search or just *displays* the query while the shell still feeds characters in. Clarify: CommandBar is presentational; shell still routes keys.

4. **OpenTUI React renderer integration is named but not pinned.** The PRD says "Mount a single React root through the OpenTUI React renderer entrypoint. Keep the existing OpenTUI CLI renderer configuration, including `exitOnCtrlC: false` and `useMouse: false`." `@opentui/react` exposes several entry shapes (custom renderer + root, render-to-renderer, hooks). The PRD does not say which API to use, where input handlers should attach (renderer.addInputHandler vs. a React hook), or whether the React root replaces `createCliRenderer` outright or sits on top of it. This is the single most error-prone shell-layer change.

5. **`bun run typecheck` is an acceptance criterion but no `tsc` is currently installed.** `package.json` declares `"typecheck": "tsc --noEmit"` but TypeScript is only a peerDependency, not a devDependency, and `tsc` is not on the lockfile. With `verbatimModuleSyntax: true` and `jsx: "react-jsx"` already set, the React/JSX migration will surface real type errors. The PRD should require ensuring `typescript` is available locally (devDependency or otherwise) so `bun run typecheck` actually runs in CI.

## Specific Findings

### F1. Triage column order is contradictory (Critical)
- **Section:** Implementation Decisions and Acceptance Criteria — "Triage columns render left to right in this order: Inbox, needs-triage, needs-info, ready-for-human, ready-for-agent, wontfix, Conflicted."
- **Why it matters:** `docs/initial-phase.md` lists the lanes in a different order, `boardState.ts` `TRIAGE_LANE_KEYS` is in yet another order (`ready-for-agent` before `ready-for-human`), and existing tests in `src/issues/boardState.test.ts` and `src/issues/issueBoard.test.ts` assert against the current order. An agent updating tests will break invariants other modules silently depend on, and the source of truth becomes ambiguous.
- **Suggested fix:** Add a sentence: "This PRD is the canonical source for triage column UI order. `docs/initial-phase.md` should be updated in the same change. `boardState.ts` `TRIAGE_LANE_KEYS` should match this order." Or, if `docs/initial-phase.md` is canonical, restate the PRD column order to match it exactly.

### F2. `BoardSelection` → `BoardCursor` migration boundary (High)
- **Section:** Implementation Decisions — "Replace `BoardSelection` with `BoardCursor` in board state. Add a derived helper for selected issue/card lookup..."
- **Why it matters:** `BoardState.selection` is read by `getSelectedCard`, `getSelectedIssueUrl`, `moveSelectedIssueToTriageDestination`, `markSelectedIssueReadyToRun`, `unmarkSelectedIssueReadyToRun`, `reduceBoardState`, and `shell.ts`'s `renderSelectionSummary`. The PRD doesn't say whether `BoardSelection` the type is deleted, whether `BoardState` exports cursor + visible columns, or what the helper signature is.
- **Suggested fix:** Add: "`BoardState.selection: BoardSelection` is replaced by `BoardState.cursor: BoardCursor` plus a derived helper, e.g. `getSelectedCard(boardState): IssueCard | undefined`. `BoardSelection` type may be removed. Mutation entry points (`moveSelectedIssueToTriageDestination`, `markSelectedIssueReadyToRun`, `unmarkSelectedIssueReadyToRun`, `getSelectedIssueUrl`) keep their signatures and use the helper internally. Shell `renderSelectionSummary` is replaced by the StatusBar selected-issue summary."

### F3. `slotIndexByColumn` key stability under data churn (High)
- **Section:** Implementation Decisions — `slotIndexByColumn: Record<number, number | undefined>` plus "Treat cursor indexes as visual coordinates. Use stable column and slot keys for identity and rendering."
- **Why it matters:** Using `columnIndex` (number) as the key in `slotIndexByColumn` means a future column reorder, a switch from triage to run and back (the run screen has columns at indices 0–1 that overlap triage indices), or any per-screen scope change will silently smear remembered slot positions across columns. The PRD already says cursors don't persist across screen switches, but it does not say whether `slotIndexByColumn` is scoped per-screen, reset on screen switch, or keyed by column key under the hood.
- **Suggested fix:** Add: "Each screen has its own `BoardCursor` instance; switching screens resets the destination screen's cursor. Within a screen, `slotIndexByColumn` is keyed by visual column index because column order is fixed for the lifetime of the screen." Also state explicitly that closing the run screen and reopening discards `slotIndexByColumn`.

### F4. Cursor normalization on refresh/mutation is under-specified (Medium)
- **Section:** Implementation Decisions — "When visible slots change because of search, refresh, or mutation, normalize the cursor by clamping `columnIndex` to an existing column and clamping the focused column's slot index to its visible slots."
- **Why it matters:** After a successful triage move, the selected card disappears from the source lane. Should the cursor stay on the same visual slot index (now pointing to the next card down), follow the card to its new column, or move to the previous slot? Current `boardState.ts` clamps `cardIndex` but keeps `laneKey`. Without a rule, two agents will pick different behaviors and one will violate the acceptance criterion silently.
- **Suggested fix:** Add: "After a mutation that removes the selected card from the focused column, leave `columnIndex` unchanged and clamp the focused slot index to the new visible slot length. Do not follow the card to its new column."

### F5. Search input routing inconsistent across sections (Medium)
- **Section:** Implementation Decisions ("Keystroke routing stays high in the application/shell layer...") vs. Command Availability table ("Search focused | Current search query, type to filter, Backspace clear, Esc cancel") vs. User Story #12.
- **Why it matters:** An agent reading the table row could implement a CommandBar that captures keystrokes via OpenTUI focus, contradicting the explicit "shell owns input routing" rule. Today `shell.ts` checks `isSearchTextInput` and feeds characters into `setSearchQuery`.
- **Suggested fix:** In the Command Availability table caption add: "CommandBar is presentational. Keystrokes continue to be routed by the shell input handler; CommandBar only renders the current mode."

### F6. OpenTUI React renderer entrypoint is not pinned (High)
- **Section:** Implementation Decisions — "Mount a single React root through the OpenTUI React renderer entrypoint."
- **Why it matters:** The agent has to choose between `render(<App />, { exitOnCtrlC: false, useMouse: false })` style and a manually constructed `createCliRenderer` + `renderToRenderer(root, <App />)` style. Today's shell uses `createCliRenderer({ exitOnCtrlC: false, useMouse: false })` and `renderer.addInputHandler(...)`. The PRD requires preserving both renderer options and the input handler integration, but does not say whether the React entrypoint subsumes `createCliRenderer` or wraps it.
- **Suggested fix:** Pick one. For example: "Use `createCliRenderer({ exitOnCtrlC: false, useMouse: false })` from `@opentui/core` and mount the React root with `@opentui/react`'s `render(<WatchtowerApp ... />, renderer)`. Continue to attach the existing `renderer.addInputHandler` rather than routing keystrokes through React."

### F7. `bun run typecheck` requires `typescript` to be installable (Medium)
- **Section:** Acceptance Criteria — "`bun test` and `bun run typecheck` pass."
- **Why it matters:** `package.json` only declares `typescript` as a peerDependency. `bun run typecheck` will fail without `tsc` present. The React migration will introduce many new JSX nodes and `react-jsx` requires `@types/react` to type-check.
- **Suggested fix:** Add to Implementation Decisions: "Install `@types/react` and `@types/react-dom` as devDependencies, and ensure `typescript` is installed locally so `bun run typecheck` runs."

### F8. `@opentui/react` peer dep on React version is unstated (Medium)
- **Section:** Implementation Decisions — "Install `@opentui/react`, `react`, and `react-dom` as dependencies before implementation work that imports React bindings."
- **Why it matters:** `@opentui/react` will pin to a specific React major version (commonly 18 vs 19). Picking the wrong major causes peer-dep warnings or runtime breakage. The PRD should not pin a version (good) but should require letting `bun install @opentui/react react react-dom` resolve naturally and verifying the peer constraint.
- **Suggested fix:** Add: "Install `@opentui/react` first; install `react` and `react-dom` at the major version `@opentui/react` lists as its peer dependency. Do not pin React independently."

### F9. CommandBar wording differs from `docs/ui-design.md` (Low)
- **Section:** Command Availability table vs. `docs/ui-design.md` "Command And Status Bars".
- **Why it matters:** `docs/ui-design.md` gives literal hint strings like `j/k slot | h/l column | m move | p mark ready | o open | / search | Ctrl+R refresh | q exit`. The PRD's table describes them abstractly ("Slot/column navigation, move, mark ready, open, search, refresh, exit"). An agent could compose a different hint format and pass acceptance criteria.
- **Suggested fix:** Add: "CommandBar hint strings follow the examples in `docs/ui-design.md`; deviations require updating that guide."

### F10. "Hide selected-issue commands when empty column focused" lacks definition (Low)
- **Section:** "Selected-issue commands should be hidden, not greyed out, when an empty column is focused."
- **Why it matters:** It is clear which commands are selected-issue commands in the table, but an agent could read this rule as also hiding `open` for the closed-run "no card focused" case. Cross-check: closed-run does include `o open` and `unmark`. State explicitly which commands are "selected-issue commands."
- **Suggested fix:** Add: "Selected-issue commands are: `move`, `mark ready`, `unmark ready`, and `open`. Search, refresh, navigation, and exit are always available."

### F11. WatchtowerApp signature and screen separation (Low)
- **Section:** Implementation Decisions — "Mount a top-level app component that receives shell state and a dispatch/action callback, for example `<WatchtowerApp state={state} onAction={onAction} />`."
- **Why it matters:** Today `shell.ts` also fires async effects directly from `runWatchtowerCli` (e.g. `void markReadyToRun()`). The PRD says effects don't move into React. So `onAction` is just the semantic action dispatcher — clarify the prop is sync `(action: WatchtowerAction) => void` and the shell continues to be the place where async branches and `refreshIssueBoard()` live.
- **Suggested fix:** Add: "`onAction: (action: WatchtowerAction) => void` dispatches a semantic action to the existing shell reducer; the shell is responsible for any subsequent async effects."

### F12. Empty-state copy strategy under search (Low)
- **Section:** Acceptance Criteria — "Search filters cards globally on the active board; columns remain visible; empty states distinguish filtered-out results from genuinely empty GitHub state."
- **Why it matters:** Today `boardState.ts` filters lanes and substitutes `SEARCH_EMPTY_STATE` only for lanes that previously had cards. Lanes that were already empty keep their original empty-state copy. The PRD does not say whether this rule is preserved. An agent could decide to show the search-empty copy in every column when a query is active.
- **Suggested fix:** Add: "Lanes that were empty before the search query continue to show their genuinely-empty copy. Lanes that had cards filtered out show the search-filter copy. This preserves existing `filterLane` behavior."

### F13. "Disposable prototype renderer" wording vs. file-level migration scope (Low)
- **Section:** Implementation Decisions — "Replace the active imperative `renderer.root.add(...)` shell rendering path. Do not keep a compatibility bridge or parallel active render path for the prototype row UI."
- **Why it matters:** `shell.ts` is currently one file mixing render path, input handler, async effect orchestration, and shell state reducer. The PRD intends only the render path to change. Make explicit that the input handler, async effect functions (`refreshIssueBoard`, `moveSelectedIssue`, `markReadyToRun`, `unmarkReadyToRun`, `openSelectedIssue`, `retrySetupPreflight`), and `reduceShellState` stay in `shell.ts` or near it.
- **Suggested fix:** Add: "The shell input handler, async effect callbacks, and `reduceShellState` remain outside React. Only `createWatchtowerShellView`, `createPreflightFailureView`, `renderBoardText`, and `renderActionPromptText` are replaced by the React tree."

### F14. Conflicted lane move semantics in CommandBar are unstated (Low)
- **Section:** Command Availability — "Triage issue selected | Slot/column navigation, move, mark ready, open, search, refresh, exit"
- **Why it matters:** Move menu options today are `0 Inbox`, `1 needs-triage`, `2 needs-info`, `3 ready-for-agent`, `4 ready-for-human`, `5 Close as wontfix`. The PRD does not state whether the move menu is unchanged or whether it should be rebuilt as part of CommandBar rendering. An agent could re-label, reorder, or strip the conflicted column from move targets.
- **Suggested fix:** Add: "Move menu options and key bindings (`0`–`5`) preserve current behavior. Conflicted is not a move destination; cards leave Conflicted by being moved into a canonical lane or Inbox."

### F15. Header navigation hints overlap with `q exit` (Low)
- **Section:** Implementation Decisions — "Screen-switch hints are shown with Header navigation: `1`/`t` for triage and `2`/`r` for run."
- **Why it matters:** The CommandBar already lists `q exit`. Header lists screen nav. Does Header also include exit, or is exit only ever in CommandBar? `docs/ui-design.md` is silent.
- **Suggested fix:** Add: "Exit is shown only in CommandBar. Header shows only app identity and screen navigation."

## Agent Tripwires

- An agent will see "Replace `BoardSelection` with `BoardCursor`" and either delete `BoardSelection` and break public exports of `boardState.ts`, or keep both as parallel state and silently violate "Do not build a compatibility bridge."
- An agent will see the table row `Search focused | type to filter | Backspace clear | Esc cancel` and try to make `CommandBar` capture keystrokes via OpenTUI focus instead of leaving keystroke routing in the shell.
- An agent will install React 19 because it's "latest" and `@opentui/react` may still pin to React 18, producing peer-dep warnings or runtime mismatches.
- An agent will replace `createCliRenderer` with a `@opentui/react` `render(<App />)` call, losing `exitOnCtrlC: false` and `useMouse: false` because the React entry has different options.
- An agent will overbuild a `BoardCursor` reducer (`cursorReducer`, action types, dispatch) rather than wiring movement into the existing `moveSelectionUp/Down/Left/Right` semantic actions, because story #45 ("manifest actions rather than interpret them") sounds like a new vocabulary even though the PRD explicitly says reuse existing actions.
- An agent will add React render/snapshot tests because the codebase grows new components, even though "Do not add new React rendering or snapshot tests in this iteration" appears only in Testing Decisions and Out of Scope.
- An agent will rewrite `renderIssueBoardLines` and the line-based renderer modules into a "kanban renderer," then panic when `issueBoard.test.ts` asserts against the line output. Clarify whether `renderIssueBoardLines` is deleted or kept (the PRD says the prototype renderer is disposable, but `renderIssueBoardLines` is also still used by tests).
- An agent will move the move menu's `0`–`5` numeric handling into the CommandBar component, violating the "keystroke routing stays high" rule.
- An agent will update `boardState.ts` `TRIAGE_LANE_KEYS` order and break unrelated tests in `boardState.test.ts` and `issueBoard.test.ts` that hardcode the old order — without realizing the PRD warned only about "updated tests" abstractly.
- An agent will move `getSelectedIssueUrl`, `getSelectedCard` out of `boardState.ts` into `src/components/issues/` because the PRD says "issue-to-kanban adaptation to stay near UI components."
- An agent will treat `slotIndexByColumn[columnIndex] === undefined` as "no slot in the column" and skip rendering the focused-slot highlight, even after `j` should set it to `0`. State that `j` and `k` on a column with visible slots and undefined slot index initialize the slot to `0`.

## Suggested PRD Edits

Add the following bullets to **Implementation Decisions** (or as new top-level sections):

- "This PRD is canonical for triage UI column order. `docs/initial-phase.md` and `boardState.ts` `TRIAGE_LANE_KEYS` should be updated to the same order in this iteration. Tests in `src/issues/boardState.test.ts` and `src/issues/issueBoard.test.ts` that hardcode the previous order should be updated."
- "`BoardState.selection: BoardSelection` is replaced by `BoardState.cursor: BoardCursor`. The `BoardSelection` type is removed. A new helper `getSelectedCard(boardState): IssueCard | undefined` lives in `src/issues/boardState.ts` and is used by `getSelectedIssueUrl`, `moveSelectedIssueToTriageDestination`, `markSelectedIssueReadyToRun`, and `unmarkSelectedIssueReadyToRun`."
- "`slotIndexByColumn` is keyed by visual column index. Each screen owns its own `BoardCursor` instance; switching screens resets the destination screen's cursor."
- "After a mutation removes the selected card from the focused column, leave `columnIndex` unchanged and clamp the focused column's slot index to the new visible slot length; do not follow the card to its new column."
- "On `j` or `k` over a focused column with visible slots and `slotIndexByColumn[columnIndex] === undefined`, set the slot index to `0` before applying the delta."
- "CommandBar is presentational. Keystrokes continue to be routed by `shell.ts`'s renderer input handler; CommandBar only renders the current mode."
- "Use `createCliRenderer({ exitOnCtrlC: false, useMouse: false })` from `@opentui/core` and mount the React root via `@opentui/react`'s renderer integration against that renderer. Continue to attach input via `renderer.addInputHandler` rather than React event handlers."
- "Install `@opentui/react` first; install `react` and `react-dom` at the major version `@opentui/react` lists as its peer dependency. Also install `@types/react`, `@types/react-dom`, and `typescript` as devDependencies so `bun run typecheck` runs locally."
- "`WatchtowerApp` props are `{ state: WatchtowerShellState, onAction: (action: WatchtowerAction) => void }`. Async effects (`refreshIssueBoard`, mutation effects, `openIssueInBrowser`) stay in `shell.ts`."
- "Only `createWatchtowerShellView`, `createPreflightFailureView`, `renderBoardText`, and `renderActionPromptText` in `shell.ts` are replaced by the React tree. `reduceShellState`, the renderer input handler, and the async effect callbacks remain."
- "Move menu options and key bindings (`0`–`5`) preserve current behavior and continue to be handled by `shell.ts`'s `handleMoveMenuInput`. CommandBar renders the same options as text."
- "Selected-issue commands are `move`, `mark ready`, `unmark ready`, and `open`. They are hidden (not greyed) when the focused column is empty. Navigation, search, refresh, and exit are always shown."
- "Lanes that were empty before the search query continue to show their genuinely-empty copy; lanes that had cards filtered out show the search-filter copy. This matches existing `filterLane` behavior."
- "Header shows app identity and screen navigation only. Exit is shown only in CommandBar."

Add to **Acceptance Criteria**:

- "`docs/initial-phase.md` triage lane order and `boardState.ts` `TRIAGE_LANE_KEYS` match the PRD column order."
- "`BoardState.selection` is removed; `BoardState.cursor: BoardCursor` is the only cursor state; `getSelectedCard` is the only selection lookup helper."
- "`createCliRenderer({ exitOnCtrlC: false, useMouse: false })` is preserved and the React root is mounted onto that renderer; `renderer.addInputHandler` is still used for keystroke routing."

Add to **Testing Decisions**:

- "Update `src/issues/boardState.test.ts` and `src/issues/issueBoard.test.ts` for the new triage column order and the cursor model. Do not delete coverage; update assertions in place."
