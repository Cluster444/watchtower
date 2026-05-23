# PRD: React Kanban Terminal UI

## Problem Statement

Watchtower currently displays the issue board as text rows inside a quick prototype shell. The app generally displays correctly, but the layout does not yet feel like a durable keyboard-first control surface. Keybindings are shown as a static line below content, issue information is flattened into one row per issue, empty workflow groupings do not have strong spatial presence, and there is no reusable board component model for future Watchtower screens.

The next iteration needs to formalize the UI architecture around OpenTUI React components and a generic kanban board concept. Users should be able to see the shape of the triage screen and run screen as boards with columns and slots, move a visual board cursor with Vim-style keys, understand which issue card is selected, and see contextual commands and status without the command/help content being randomly placed below the board.

## Solution

Watchtower will migrate its terminal rendering path to OpenTUI React bindings and introduce a reusable kanban UI component system. The active screen will render one kanban-style board. The triage screen will render columns for Inbox, canonical triage states, and Conflicted issues. The run screen will render Ready to run and Closed columns. Columns remain visible even when empty, and issue cards render as compact multi-line content inside generic slots.

The shell layout will follow the durable UI design guide: Header, Board, CommandBar, StatusBar. The Header shows app identity and screen navigation. The Board presents columns and slots. The CommandBar shows contextual commands, search input, move menus, and confirmation prompts. The StatusBar shows current screen, selected column or issue, loading state, mutation results, and errors.

The kanban board will use a visual board cursor. The cursor tracks the focused column by index and remembers a focused slot index per column. Cursor movement is visual only and must not mutate GitHub issues. Existing semantic actions, issue classification, mutation planning, preflight behavior, and GitHub integration remain in place unless a small change is required to connect them to the new UI.

## Required References

- `docs/ui-design.md` is normative for shell layout, component boundaries, kanban primitives, command/status bar behavior, theme direction, and the action boundary.
- `docs/initial-phase.md` is normative for triage and run screen semantics, issue mutation behavior, confirmation rules, search scope, empty states, setup preflight, and phase-one non-goals.
- `CONTEXT.md` is normative for domain glossary terms such as **Watchtower**, **issue board**, **issue card**, and **board cursor**.
- `docs/adr/0001-use-bun-and-opentui-for-the-terminal-ui.md` is normative for the Bun and OpenTUI direction.

## User Stories

1. As a Watchtower user, I want the triage screen to look like a kanban board, so that I can understand the workflow shape at a glance.
2. As a Watchtower user, I want the run screen to look like a kanban board, so that I can distinguish ready-to-run eligible issues from closed eligible issues.
3. As a Watchtower user, I want each board column to stay visible even when empty, so that I can understand which workflow states exist.
4. As a Watchtower user, I want empty columns to show explicit empty states, so that I can tell the difference between no issues and missing UI.
5. As a Watchtower user, I want issue cards to render as compact multi-line cards, so that titles, workflow labels, body previews, and update ages are readable.
6. As a Watchtower user, I want one active board per screen, so that the UI does not mix triage and run workflows on the same screen.
7. As a Watchtower user, I want the Header to show app identity, so that I always know I am operating Watchtower.
8. As a Watchtower user, I want the Header to show screen navigation, so that I can tell whether I am on the triage screen or run screen.
9. As a Watchtower user, I want screen navigation to stay at the top of the UI, so that navigation is separated from transient status messages.
10. As a Watchtower user, I want the CommandBar to show available commands, so that I do not need to memorize every keybinding.
11. As a Watchtower user, I want command hints to change based on the current selection, so that unavailable commands are not suggested.
12. As a Watchtower user, I want the CommandBar to show search input while search is focused, so that search feels like a modal keyboard interaction.
13. As a Watchtower user, I want the CommandBar to show move menu options, so that moving an issue does not disturb the board layout.
14. As a Watchtower user, I want the CommandBar to show confirmation prompts, so that destructive or risky actions are clearly separated from board content.
15. As a Watchtower user, I want the StatusBar to show the current screen and selected issue, so that I can understand what my next command will act on.
16. As a Watchtower user, I want the StatusBar to show loading and mutation feedback, so that I know whether Watchtower is working or blocked.
17. As a Watchtower user, I want errors to appear in a stable status area, so that failures are visible without reflowing the board.
18. As a keyboard-first user, I want `h` and `l` to move the board cursor between columns, so that horizontal movement feels like Vim.
19. As a keyboard-first user, I want `j` and `k` to move the slot cursor within the focused column, so that vertical movement feels like Vim.
20. As a keyboard-first user, I want cursor movement to be visual only, so that moving around the board never mutates GitHub issues by accident.
21. As a keyboard-first user, I want to focus an empty column, so that column movement remains consistent even when there are no issues in a workflow state.
22. As a keyboard-first user, I want each column to remember its own slot cursor, so that moving away from a column and back returns me to the same visual position.
23. As a keyboard-first user, I want the focused column to be visually highlighted, so that I always know which column I am in.
24. As a keyboard-first user, I want the focused slot to be visually highlighted more strongly than the focused column, so that I always know which issue card is selected.
25. As a Watchtower user, I want empty focused columns to be highlighted, so that I can distinguish focused empty state from inactive empty state.
26. As a Watchtower user, I want selected issue commands to disappear or become unavailable when an empty column is focused, so that I do not attempt commands with no selected issue.
27. As a Watchtower user, I want issue-specific commands such as move, mark ready, unmark ready, and open to act only on the selected issue card, so that actions remain predictable.
28. As a Watchtower user, I want the triage screen to preserve existing triage move behavior, so that moving cards still changes canonical triage labels as before.
29. As a Watchtower user, I want `Close as wontfix` to keep requiring confirmation, so that destructive issue closure remains deliberate.
30. As a Watchtower user, I want promotion to the run screen to keep requiring confirmation when appropriate, so that issues are not accidentally made eligible for Sandcastle workflows.
31. As a Watchtower user, I want demotion from the run screen to preserve current behavior, so that eligible issues can return to the triage screen when allowed.
32. As a Watchtower user, I want closed run-screen issues to remain visible in the Closed column, so that I can review recently closed eligible issues.
33. As a Watchtower user, I want closed run-screen issues to avoid unsupported commands, so that I am not shown actions that phase one does not allow.
34. As a Watchtower user, I want search to remain a global filter over loaded cards, so that I can quickly narrow the current board.
35. As a Watchtower user, I want columns to remain visible during search, so that filtering does not hide the workflow shape.
36. As a Watchtower user, I want search empty states to distinguish filtered-out content from genuinely empty GitHub state, so that I understand why no cards are visible.
37. As a Watchtower user, I want refresh to remain available from the command hints, so that I can reload GitHub issue state manually.
38. As a Watchtower user, I want opening the selected issue in GitHub to preserve current fallback behavior, so that headless or browser-open failures still show the issue URL.
39. As a Watchtower user, I want setup preflight failures to remain clear, so that missing setup still blocks startup with actionable remediation.
40. As a Watchtower maintainer, I want a reusable Board component, so that future screens can share kanban layout and cursor behavior.
41. As a Watchtower maintainer, I want reusable Column and Slot components, so that column chrome and selectable item chrome are separated from issue-specific rendering.
42. As a Watchtower maintainer, I want IssueCard to be issue-specific and rendered inside Slot, so that generic kanban components do not know about GitHub issues.
43. As a Watchtower maintainer, I want issue-to-kanban adaptation to stay near UI components, so that presentation mapping does not leak into domain classification modules.
44. As a Watchtower maintainer, I want visual cursor helpers to be testable without OpenTUI, so that board movement behavior is stable and easy to change.
45. As a Watchtower maintainer, I want components to manifest actions rather than interpret them, so that UI rendering is separated from application behavior.
46. As a Watchtower maintainer, I want application code to keep interpreting semantic actions, so that existing behavior tests and mutation flows remain useful.
47. As a Watchtower maintainer, I want React rendering to consume existing state and callbacks, so that data loading and GitHub mutation effects do not move into presentation components.
48. As a Watchtower maintainer, I want the current line-based renderer to be replaced, so that the prototype UI does not constrain the durable component architecture.
49. As a Watchtower maintainer, I want the theme to be shared, so that colors and visual tokens are not scattered through components.
50. As a Watchtower maintainer, I want selected column and selected slot colors to follow a clear hierarchy, so that the control surface is visually coherent.
51. As a Watchtower maintainer, I want the design to use OpenTUI React bindings, so that reusable UI pieces are expressed as real React components.
52. As a Watchtower maintainer, I want the renderer migration to be limited to rendering concerns, so that CLI lifecycle and GitHub integration do not become part of the UI cleanup.
53. As a future Watchtower contributor, I want a durable UI design guide, so that implementation details can be checked against a shared design direction.
54. As a future Watchtower contributor, I want the kanban board to be generic, so that terms like column and slot are not tied to issue board domain language.
55. As a future Watchtower contributor, I want domain glossary terms to stay separate from UI primitive names, so that **Issue board**, **Issue card**, and **Board cursor** remain precise.

## Implementation Decisions

- Migrate the rendering path to OpenTUI React bindings so the UI can be expressed as real React components.
- Install `@opentui/react`, `react`, and `react-dom` as dependencies before implementation work that imports React bindings.
- Mount a single React root through the OpenTUI React renderer entrypoint. Keep the existing OpenTUI CLI renderer configuration, including `exitOnCtrlC: false` and `useMouse: false`.
- Use the existing `createCliRenderer({ exitOnCtrlC: false, useMouse: false })` setup from `@opentui/core` and mount the React root against that renderer using `@opentui/react`. Continue attaching input through the renderer input handler rather than React keyboard hooks in this iteration.
- Replace the active imperative `renderer.root.add(...)` shell rendering path. Do not keep a compatibility bridge or parallel active render path for the prototype row UI.
- Mount a top-level app component that receives shell state and a dispatch/action callback, for example `<WatchtowerApp state={state} onAction={onAction} />`. Do not introduce React Context for shell state in this iteration.
- `WatchtowerApp` receives `WatchtowerShellState` and `onAction: (action: WatchtowerAction) => void`. The shell remains responsible for subsequent async effects such as refreshing issues, mutating issues, and opening GitHub URLs.
- Install React at the major version required by `@opentui/react`'s peer dependency. Do not independently pin a conflicting React major version.
- Install `@types/react`, `@types/react-dom`, and local `typescript` dev tooling so `bun run typecheck` runs reliably.
- Preserve current application behavior while replacing the prototype row-based rendering with a component hierarchy.
- Keep data loading, setup preflight, GitHub mutation effects, and process lifecycle outside the React presentation components.
- Only the shell render tree is replaced by React. The shell reducer, renderer input handler, and async effect callbacks remain outside React.
- Use the shell layout stack defined in the UI design guide: Header, Board, CommandBar, StatusBar.
- Failed setup preflight keeps the dedicated preflight failure view rather than the main kanban shell. Preserve retry and exit behavior.
- Before the issue board has loaded, the UI must not offer issue mutation commands.
- Render one board per active screen. The triage screen renders the triage board. The run screen renders the run board.
- Triage columns render left to right in this order: Inbox, needs-triage, needs-info, ready-for-human, ready-for-agent, wontfix, Conflicted. This is an intentional UI order and should be reflected in updated tests.
- Run columns render left to right in this order: Ready to run, Closed.
- Build a generic kanban module with Board, Column, Slot, kanban types, and cursor helpers.
- Build generic shell layout components for Header, CommandBar, and StatusBar.
- Build issue-specific presentation pieces that adapt the current issue board data into kanban columns and render issue cards inside slots.
- Expected module map:
  - `src/components/kanban/`: Board, Column, Slot, kanban types, and pure cursor helpers.
  - `src/components/layout/`: Header, CommandBar, StatusBar, and any pure command availability model.
  - `src/components/issues/`: IssueCard and the issue-board-to-kanban adapter.
  - `src/components/theme.ts`: shared color and visual tokens.
- `src/components` owns Watchtower UI state and UI logic, including board cursor state, search query/focus, visible kanban columns, selected issue derivation for the current UI, command availability, layout, and theme.
- `src/issues` is the interface-agnostic issue boundary. It owns GitHub issue loading, issue fetching, label vocabulary application, issue mutation planning/execution, and shared issue shapes/types already present in the codebase.
- Move active board cursor/search/visible-board UI state out of `src/issues/boardState.ts`. Do not add new Watchtower UI state to `src/issues`.
- Do not require a full `Issue` namespace, Zod schema layer, or domain command schema migration in this PRD. A future iteration may formalize shared issue schemas and action execution boundaries.
- UI code should reuse exported issue/domain types where practical and should avoid inventing local issue reshapes.
- Keep the kanban components free of GitHub, Sandcastle, canonical triage label, and mutation-planning knowledge.
- Keep issue classification and mutation planning in existing domain/application modules.
- Use a controlled Board component. The Board receives columns and cursor state, and renders the current cursor rather than owning application state internally.
- Board props should stay small: columns and cursor are required; cursor changes are driven by existing semantic actions in parent state, not local Board state.
- Use a visual board cursor with this canonical shape:

```ts
type BoardCursor = {
  columnIndex: number;
  slotIndexByColumn: Record<number, number | undefined>;
};
```

- Treat cursor indexes as visual coordinates. Use stable column and slot keys for identity and rendering.
- Column keys in the issue adapter use the existing issue board lane keys. Slot keys use stable issue identity, such as the GitHub issue number converted to a string.
- Make `columnIndex` the focused column. Make `slotIndexByColumn[columnIndex]` the focused slot in that column, or `undefined` when the focused column has no selectable slots.
- Make horizontal movement change only `columnIndex`.
- Make vertical movement change only the focused column's slot index.
- Allow empty columns to be focused. Empty focused columns have no selected issue.
- Make cursor movement visual only. It must not mutate GitHub issues.
- Replace the existing selection model with the board cursor. Do not build a compatibility bridge that keeps both `selection` and `cursor` as active state.
- Replace the old `BoardSelection` model with `BoardCursor`. Add a derived helper for selected issue/card lookup from the normalized cursor and active kanban columns. Mutation entry points should keep their public behavior but receive/read the selected issue through that helper.
- Do not keep compatibility shims, legacy re-exports, or parallel old/new APIs for the old board state API. Update imports and tests directly to the new UI-layer modules.
- If `src/issues/boardState.ts` no longer has interface-agnostic issue responsibilities after UI state moves out, delete it. Do not leave dead compatibility code.
- Remove skip-empty-column behavior. Horizontal cursor movement must visit every column whether or not it contains slots.
- Clamp horizontal cursor movement at the first and last columns. Do not wrap.
- `j` and `k` on an empty focused column are no-ops and leave that column's slot index as `undefined`.
- The normalized cursor invariant is: every column with visible slots has a valid integer slot index from `0` to `slots.length - 1`, and every column with zero visible slots has slot index `undefined`.
- Normalize the cursor for all columns whenever visible columns or slots change, including initial render, search changes, refresh, mutation result, and screen switch.
- Initial board cursor is `columnIndex: 0`, then normalized against the visible columns.
- When a column becomes focused, normalize that column immediately. If it has visible slots and no remembered slot index, set its slot index to `0`. If it has no visible slots, set its slot index to `undefined`.
- When visible slots change because of search, refresh, or mutation, preserve current visual cursor position where possible and clamp all remembered slot indexes to the current visible slots.
- After a mutation removes the selected issue card from the focused column, keep `columnIndex` unchanged and clamp the focused column's slot index to the new visible slot range. Do not follow the card to another column.
- Switching screens resets the destination screen cursor to its initial position for this iteration. Persisting cursor position across screens is out of scope.
- Keep `h`, `j`, `k`, and `l` as the core board navigation keys.
- Keep existing `WatchtowerAction` names such as `moveSelectionUp`, `moveSelectionDown`, `moveSelectionLeft`, and `moveSelectionRight` in this iteration. Renaming these actions to cursor terminology is out of scope.
- Preserve existing keybindings for move, mark ready, unmark ready, open, search, refresh, exit, confirm, cancel, and arrow-key navigation aliases. CommandBar hints must reflect the actual mappings.
- Keep raw input mapping to semantic actions before reducers update state.
- React components render state and invoke callbacks with existing semantic actions. They do not run reducers, call GitHub, execute issue mutations, or interpret domain actions.
- Application/domain code outside interface-specific components interprets actions, updates state, and performs effects.
- Keystroke routing stays high in the application/shell layer for this iteration. Search text input, move-menu number keys, confirmation Enter/Esc handling, and component focus routing should not move into leaf React components.
- CommandBar is presentational. It renders the current command mode and hints; it does not capture keystrokes.
- While search, move menu, or confirmation mode is active, normal board navigation keys do not move the board cursor.
- Move command hints, move menus, search input, and confirmation prompts into CommandBar.
- Preserve the current move menu options and key bindings. Conflicted is not a move destination; conflicted issue cards leave Conflicted by moving to Inbox or a canonical triage column. Moving to `wontfix` is presented as `Close as wontfix` and requires confirmation.
- Keep transient status, selected issue summaries, loading feedback, mutation results, and errors in StatusBar.
- Keep Header focused on app identity and screen navigation. Screen-switch hints are shown with Header navigation: `1`/`t` for triage and `2`/`r` for run.
- Exit is shown in CommandBar, not Header.
- Keep search global to the current board rather than per-column.
- Keep columns visible during search. Empty states should distinguish genuinely empty state from filtered-out results.
- Preserve existing search matching fields: issue number, title, workflow labels, and body preview.
- Preserve existing search empty-state behavior: columns that were empty before the query keep their genuinely-empty copy, while columns whose cards were filtered out show the search-filter empty copy.
- Keep current card content fields: issue number, workflow labels, title, body preview, and updated age.
- Render issue card content as simple compact multi-line content inside slots instead of one long row. Preserve existing body preview truncation unless the implementation needs a smaller cap for layout.
- At minimum, IssueCard renders issue number, workflow labels, title, body preview, and updated age inside the slot. Prefer simple layout over verbose visual detail.
- Canonical triage role names define column identity and order. Visible triage column labels and issue workflow labels should use configured tracker label strings where applicable, and mutations must continue using configured label spelling.
- Use a restrained terminal control-surface theme with a shared theme module.
- Use a visual hierarchy where normal background is darkest, focused column background is slightly lighter, and focused slot background is lighter than the focused column.
- Treat current row rendering and static keybinding placement as disposable prototype UI.
- Remove `renderIssueBoardLines` from the active UI path. Replace line-rendering tests with issue-to-kanban adapter coverage, and delete the function if it becomes unused.
- When every triage column is empty, still render every triage column with per-column empty state copy. Do not collapse to a single `Triage (0)` banner.
- If vertical overflow occurs, columns may clip/truncate within column bounds. Independent scrolling and keeping offscreen selected slots visible are out of scope for this iteration.
- Do not introduce a new action vocabulary for this iteration. Reuse existing semantic actions where possible.
- Do not introduce a new CLI orchestration architecture. Limit shell changes to what is required to mount React and pass state/actions into React.

## Breaking Changes From Prototype

- Triage board column order changes to Inbox, needs-triage, needs-info, ready-for-human, ready-for-agent, wontfix, Conflicted. Update code and tests to match this order.
- Board navigation no longer skips empty columns.
- Horizontal movement no longer resets the target column slot index to `0`; each column remembers its own normalized slot index.
- Empty columns use `undefined` slot index and have no selected issue.
- All-empty triage boards still render every column with per-column empty states instead of collapsing into a single empty message.
- Active UI board cursor/search/visible-board state moves out of `src/issues` and into UI-layer modules under `src/components`.

## Command Availability

| Context | CommandBar content |
| --- | --- |
| Triage issue selected | Slot/column navigation, move, mark ready, open, search, refresh, exit |
| Run open issue selected | Slot/column navigation, unmark ready, open, search, refresh, exit |
| Run closed issue selected | Slot/column navigation, open, search, refresh, exit |
| Empty column focused | Column navigation, search, refresh, exit |
| Search focused | Current search query, type to filter, Backspace clear, Esc cancel |
| Move menu open | Move destinations and Esc cancel |
| Confirmation pending | Confirmation message, Enter confirm, Esc cancel |

Selected-issue commands should be hidden, not greyed out, when an empty column is focused.
Selected-issue commands are move, mark ready, unmark ready, and open. Navigation, search, refresh, and exit remain available according to mode.

## Acceptance Criteria

- [ ] `@opentui/react`, `react`, and `react-dom` are installed.
- [ ] `@types/react`, `@types/react-dom`, and local `typescript` tooling are installed so `bun run typecheck` runs.
- [ ] `bun run dev` launches Watchtower as a React-rendered OpenTUI app.
- [ ] The existing `createCliRenderer({ exitOnCtrlC: false, useMouse: false })` setup and renderer input handler are preserved while React renders the UI.
- [ ] The active shell layout renders Header, Board, CommandBar, and StatusBar in that order.
- [ ] The active shell path no longer uses the prototype row-based board renderer or static keybinding line below board content.
- [ ] The triage screen renders exactly one board with columns ordered: Inbox, needs-triage, needs-info, ready-for-human, ready-for-agent, wontfix, Conflicted.
- [ ] The run screen renders exactly one board with columns ordered: Ready to run, Closed.
- [ ] Every column remains visible when empty and during search.
- [ ] `h` and `l` move the board cursor through every column, including empty columns, clamp at edges, and do not mutate GitHub issues.
- [ ] `j` and `k` move the slot cursor within the focused column, clamp at edges, no-op on empty columns, and do not mutate GitHub issues.
- [ ] Each column remembers its own slot index while on the active screen.
- [ ] The normalized cursor invariant holds for all columns: non-empty columns have valid slot indexes and empty columns have `undefined` slot indexes.
- [ ] `h/j/k/l` and arrow-key navigation aliases do not move the cursor while search is focused, the move menu is open, or a confirmation prompt is pending.
- [ ] Empty focused columns have no selected issue and hide selected-issue commands.
- [ ] Failed setup preflight uses the dedicated preflight view; retry and exit still work.
- [ ] Before the issue board loads, issue mutation commands are not shown.
- [ ] The focused column is visually lighter than the board background, and the focused slot is visually lighter than the focused column.
- [ ] CommandBar content follows the command availability table.
- [ ] StatusBar shows current screen, selected issue summary or no selected issue, loading state, latest mutation result, and latest error/status message.
- [ ] Search filters cards globally on the active board; columns remain visible; empty states distinguish filtered-out results from genuinely empty GitHub state.
- [ ] Triage moves, Close as wontfix confirmation, ready-to-run promotion confirmation, demotion behavior, closed-run unmark guard, refresh, open-in-GitHub fallback, and preflight behavior are preserved.
- [ ] Generic kanban components do not import GitHub, Sandcastle, triage labels, or mutation-planning code.
- [ ] UI cursor/search/visible-board state is not owned by `src/issues` modules.
- [ ] No compatibility shims, legacy re-exports, or parallel old/new board state APIs remain.
- [ ] `renderIssueBoardLines` is no longer used by the active shell UI.
- [ ] Pure cursor helpers, issue-to-kanban adapter, and command availability model have isolated tests that do not import OpenTUI or React.
- [ ] Existing tests are updated for the cursor model where they referenced selection.
- [ ] `bun test` and `bun run typecheck` pass.

## Testing Decisions

- Good tests should verify external behavior and stable contracts, not internal React tree structure or incidental layout implementation.
- Test the generic board cursor helpers as a deep module. These tests should cover normalizing cursor indexes, focusing empty columns, preserving each column's slot cursor, moving between columns, moving within slots, clamping at boundaries, and deriving selected slot state.
- Test issue-to-kanban adaptation as a presentation adapter. These tests should cover triage columns, run columns, empty columns, card-to-slot mapping, stable slot keys, column order, and filtered empty states where applicable.
- Test command bar model/helpers if command availability is extracted into a pure module. These tests should cover triage issue selected, run issue selected, closed run issue selected, empty column focused, search focused, move menu open, and confirmation prompt states.
- Test shell state reducers where cursor movement replaces the current lane/card selection model. These tests should cover `h/j/k/l` as visual cursor movement and confirm that cursor movement does not execute issue mutations.
- Keep existing tests for issue classification, board filtering, triage actions, preflight, GitHub gateway, and shell behavior as prior art.
- Update existing board state tests rather than duplicating coverage when the selection model is renamed to the board cursor model.
- Update shell state tests where they assert selection behavior or command/status behavior.
- Do not add new React rendering or snapshot tests in this iteration. Prefer pure data and reducer tests for behavior.
- Cursor helpers, issue adapter, and command availability model must be testable without importing OpenTUI or React.
- Run the existing Bun test suite after implementation.
- Run TypeScript typechecking after implementation because the React migration changes JSX configuration and dependencies.

## Out of Scope

- Starting, supervising, reviewing, merging, or closing Sandcastle run sessions.
- Adding an agent/chat command interface.
- Turning CommandBar into a prompt-based agent interface.
- Adding a selected issue detail panel.
- Redesigning GitHub mutation behavior.
- Redesigning issue classification or triage rules.
- Changing setup preflight semantics.
- Changing the `Sandcastle` label semantics.
- Adding persistence for UI state.
- Adding mouse interaction requirements.
- Adding per-column search.
- Designing a narrow-terminal fallback.
- Per-column scroll viewports or virtualization. Columns own their vertical layout in this iteration, but independent scrolling is deferred.
- Keeping offscreen selected slots visible when a column overflows vertically.
- Persisting cursor position across screen switches or board refreshes.
- Renaming `moveSelectionUp`, `moveSelectionDown`, `moveSelectionLeft`, or `moveSelectionRight` to cursor terminology.
- React Context for shell state.
- New rendering or snapshot tests for React components.
- Compatibility shims, legacy re-exports, or parallel old/new APIs for the old board state model.
- A full `Issue` namespace, Zod schema layer, or domain command schema migration.
- Publishing this PRD to GitHub before review.

## Further Notes

- The domain glossary defines Watchtower as a control surface, not a passive dashboard. The UI should continue to feel like a keyboard-first operational control surface.
- The existing ADR commits Watchtower to Bun and OpenTUI. This PRD stays within that direction and formalizes the React bindings already named in the initial phase document.
- The durable UI direction is captured in the UI design guide and should guide implementation choices that are too visual or detailed for this PRD.
- The board cursor glossary term has been added to distinguish focused board position from selected issue behavior.
- The deep modules in this iteration are the generic kanban cursor helpers, issue-to-kanban adapter, and contextual command model. These should have small interfaces and enough internal behavior to justify isolated tests.
- This `.review/prd-react-kanban-ui.md` file is the active review draft until the PRD is published to GitHub.
